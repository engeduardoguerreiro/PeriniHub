-- PeriniHub AI Sales — Fase 2: CRM, consentimento e supressão.
--
-- Integridade entre empresas: toda relação entre tabelas de empresa usa FK
-- composta (tenant_id, id), então um lead da empresa A nunca aponta para um
-- contato da B — nem pela secret key (ADR-005).
-- Classificação comercial (etapa, qualificação) e consentimento são coisas
-- separadas: um lead qualificado não pode receber mensagem por isso.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.lead_qualification as enum ('unknown', 'cold', 'warm', 'hot');
create type public.discovery_stage as enum ('company_identified', 'contact_found', 'contact_authorized', 'qualified_opportunity');
create type public.opportunity_status as enum ('open', 'won', 'lost');
create type public.activity_kind as enum ('note', 'call', 'email', 'meeting', 'message', 'stage_change', 'consent_change', 'task', 'import', 'system');
create type public.task_status as enum ('open', 'done', 'canceled');
create type public.lead_source_kind as enum ('manual', 'form', 'csv', 'ads', 'api', 'research', 'whatsapp_inbound', 'referral');
create type public.consent_channel as enum ('whatsapp', 'email', 'phone');
create type public.consent_purpose as enum ('marketing', 'sales_followup', 'service', 'transactional');
create type public.legal_basis as enum ('consent', 'legitimate_interest', 'contract', 'legal_obligation');
create type public.consent_status as enum ('granted', 'revoked');
create type public.suppression_reason as enum ('opt_out', 'complaint', 'blocked', 'invalid', 'legal_request');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Lead visível para o usuário: gestor ou acima sempre; vendedor conforme a
-- configuração da empresa (todos ou só os atribuídos a ele).
create function private.can_see_lead(p_tenant uuid, p_owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when private.org_role(p_tenant) is null then false
    when private.org_role(p_tenant) <> 'sales' then true
    when p_owner = (select auth.uid()) then true
    else coalesce((select s.sales_visibility = 'all' from public.organization_settings s where s.tenant_id = p_tenant), false)
  end
$$;

-- Exclusão lógica (deleted_at) só por gestor ou acima.
create function private.guard_soft_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and not private.is_service_role()
     and not private.has_org_role(new.tenant_id, 'manager') then
    raise exception 'delete_requires_manager' using errcode = '42501';
  end if;
  if new.tenant_id <> old.tenant_id then
    raise exception 'immutable_tenant' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Auditoria só da exclusão/restauração (o restante do histórico de CRM fica
-- em activities, sem copiar dados pessoais para a auditoria).
create function private.audit_soft_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    insert into public.audit_logs (tenant_id, actor_type, actor_id, action, entity_type, entity_id)
    values (new.tenant_id, case when (select auth.uid()) is null then 'system' else 'user' end, (select auth.uid()),
            case when new.deleted_at is null then 'restore' else 'soft_delete' end, tg_table_name, new.id::text);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastros configuráveis
-- ---------------------------------------------------------------------------

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  kind public.lead_source_kind not null default 'manual',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index lead_sources_name_key on public.lead_sources (tenant_id, lower(name));

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index pipelines_default_key on public.pipelines (tenant_id) where is_default;

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  pipeline_id uuid not null,
  name text not null check (char_length(name) between 2 and 40),
  position integer not null check (position >= 0),
  is_qualified boolean not null default false,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  color text not null default 'slate' check (color in ('slate', 'blue', 'cyan', 'violet', 'amber', 'emerald', 'red')),
  created_at timestamptz not null default now(),
  check (not (is_won and is_lost)),
  foreign key (tenant_id, pipeline_id) references public.pipelines (tenant_id, id) on delete cascade,
  unique (tenant_id, id),
  -- Permite que leads exijam etapa do mesmo pipeline por FK.
  unique (tenant_id, pipeline_id, id)
);
create index pipeline_stages_pipeline_idx on public.pipeline_stages (tenant_id, pipeline_id, position);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'slate' check (color in ('slate', 'blue', 'cyan', 'violet', 'amber', 'emerald', 'red')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index tags_name_key on public.tags (tenant_id, lower(name));

-- ---------------------------------------------------------------------------
-- Empresas e contatos
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  document text check (document is null or document ~ '^[0-9]{14}$'),
  cnae text check (cnae is null or cnae ~ '^[0-9]{7}$'),
  city text check (city is null or char_length(city) <= 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  website text check (website is null or website ~ '^https?://'),
  notes text check (notes is null or char_length(notes) <= 4000),
  -- Origem de cada informação: {"campo": {"source": "...", "at": "..."}}.
  provenance jsonb not null default '{}' check (jsonb_typeof(provenance) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
create unique index companies_document_key on public.companies (tenant_id, document) where document is not null and deleted_at is null;
create index companies_name_idx on public.companies (tenant_id, lower(name)) where deleted_at is null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  email_normalized text generated always as (lower(btrim(email))) stored,
  company_id uuid,
  job_title text check (job_title is null or char_length(job_title) <= 120),
  city text check (city is null or char_length(city) <= 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  notes text check (notes is null or char_length(notes) <= 4000),
  provenance jsonb not null default '{}' check (jsonb_typeof(provenance) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (tenant_id, company_id) references public.companies (tenant_id, id) on delete set null (company_id),
  unique (tenant_id, id)
);
-- Deduplicação por empresa: mesmo telefone ou e-mail = mesmo contato.
create unique index contacts_phone_key on public.contacts (tenant_id, phone_e164) where phone_e164 is not null and deleted_at is null;
create unique index contacts_email_key on public.contacts (tenant_id, email_normalized) where email_normalized is not null and deleted_at is null;
create index contacts_name_idx on public.contacts (tenant_id, lower(full_name)) where deleted_at is null;
create index contacts_company_idx on public.contacts (tenant_id, company_id);

create table public.contact_tags (
  tenant_id uuid not null,
  contact_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, contact_id, tag_id),
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, tag_id) references public.tags (tenant_id, id) on delete cascade
);
create index contact_tags_tag_idx on public.contact_tags (tenant_id, tag_id);

-- ---------------------------------------------------------------------------
-- Leads e oportunidades
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid,
  company_id uuid,
  lead_source_id uuid,
  pipeline_id uuid not null,
  stage_id uuid not null,
  owner_user_id uuid,
  title text check (title is null or char_length(title) <= 160),
  qualification public.lead_qualification not null default 'unknown',
  score smallint check (score is null or score between 0 and 100),
  discovery_stage public.discovery_stage not null default 'contact_found',
  stage_changed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (contact_id is not null or company_id is not null),
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, company_id) references public.companies (tenant_id, id) on delete set null (company_id),
  foreign key (tenant_id, lead_source_id) references public.lead_sources (tenant_id, id) on delete set null (lead_source_id),
  foreign key (tenant_id, pipeline_id, stage_id) references public.pipeline_stages (tenant_id, pipeline_id, id),
  -- Responsável precisa ser membro da mesma empresa.
  foreign key (tenant_id, owner_user_id) references public.organization_members (tenant_id, user_id) on delete set null (owner_user_id),
  unique (tenant_id, id)
);
create index leads_stage_idx on public.leads (tenant_id, pipeline_id, stage_id) where deleted_at is null;
create index leads_created_idx on public.leads (tenant_id, created_at desc) where deleted_at is null;
create index leads_owner_idx on public.leads (tenant_id, owner_user_id) where deleted_at is null;
create index leads_contact_idx on public.leads (tenant_id, contact_id);
create index leads_source_idx on public.leads (tenant_id, lead_source_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  title text not null check (char_length(title) between 2 and 160),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  expected_close_date date,
  status public.opportunity_status not null default 'open',
  lost_reason text check (lost_reason is null or char_length(lost_reason) <= 500),
  closed_at timestamptz,
  owner_user_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade,
  foreign key (tenant_id, owner_user_id) references public.organization_members (tenant_id, user_id) on delete set null (owner_user_id),
  unique (tenant_id, id)
);
create index opportunities_lead_idx on public.opportunities (tenant_id, lead_id);
create index opportunities_status_idx on public.opportunities (tenant_id, status, closed_at);

-- ---------------------------------------------------------------------------
-- Atividades e tarefas
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  contact_id uuid,
  kind public.activity_kind not null,
  body text check (body is null or char_length(body) <= 4000),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  actor_type public.actor_type not null default 'user',
  actor_id uuid,
  created_at timestamptz not null default now(),
  check (lead_id is not null or contact_id is not null),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);
create index activities_lead_idx on public.activities (tenant_id, lead_id, created_at desc);
create index activities_contact_idx on public.activities (tenant_id, contact_id, created_at desc);
create index activities_stage_idx on public.activities (tenant_id, created_at) where kind = 'stage_change';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  contact_id uuid,
  title text not null check (char_length(title) between 2 and 200),
  due_at timestamptz,
  assignee_user_id uuid,
  status public.task_status not null default 'open',
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignee_user_id) references public.organization_members (tenant_id, user_id) on delete set null (assignee_user_id),
  unique (tenant_id, id)
);
create index tasks_assignee_idx on public.tasks (tenant_id, assignee_user_id, status, due_at);
create index tasks_lead_idx on public.tasks (tenant_id, lead_id);

-- ---------------------------------------------------------------------------
-- Consentimento e supressão
-- ---------------------------------------------------------------------------

-- Registro imutável: cada concessão ou revogação é uma linha nova. O vigente
-- por (contato, canal, finalidade) é o mais recente (view current_consents).
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  channel public.consent_channel not null,
  purpose public.consent_purpose not null,
  legal_basis public.legal_basis not null,
  status public.consent_status not null,
  source text not null check (char_length(source) between 2 and 200),
  -- Prova: tipo, descrição e texto apresentado ao titular (quando houver).
  evidence jsonb not null default '{}' check (jsonb_typeof(evidence) = 'object'),
  expires_at timestamptz,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);
create index consent_records_contact_idx on public.consent_records (tenant_id, contact_id, channel, purpose, recorded_at desc);

create view public.current_consents with (security_invoker = true) as
  select distinct on (tenant_id, contact_id, channel, purpose)
    id, tenant_id, contact_id, channel, purpose, legal_basis, status, source, expires_at, recorded_at, recorded_by,
    (status = 'granted' and (expires_at is null or expires_at > now())) as is_valid
  from public.consent_records
  order by tenant_id, contact_id, channel, purpose, recorded_at desc, id desc;

-- Por identificador (telefone E.164 ou e-mail normalizado), não por contato:
-- vale mesmo se o contato for apagado e recriado.
create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  channel public.consent_channel not null,
  identifier text not null check (identifier ~ '^\+[1-9][0-9]{7,14}$' or (identifier = lower(identifier) and identifier like '%_@_%')),
  reason public.suppression_reason not null,
  source text not null check (char_length(source) between 2 and 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, channel, identifier),
  unique (tenant_id, id)
);

-- ---------------------------------------------------------------------------
-- Importações
-- ---------------------------------------------------------------------------

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(file_name) <= 200),
  lead_source_id uuid,
  declared_origin text not null check (char_length(declared_origin) between 3 and 500),
  consent_declared boolean not null default false,
  total_rows integer not null default 0,
  created_contacts integer not null default 0,
  updated_contacts integer not null default 0,
  created_leads integer not null default 0,
  rejected_rows integer not null default 0,
  -- Até 100 linhas rejeitadas com o motivo (sem os dados da linha).
  errors jsonb not null default '[]' check (jsonb_typeof(errors) = 'array'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, lead_source_id) references public.lead_sources (tenant_id, id) on delete set null (lead_source_id),
  unique (tenant_id, id)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger companies_updated_at before update on public.companies for each row execute function private.set_updated_at();
create trigger contacts_updated_at before update on public.contacts for each row execute function private.set_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute function private.set_updated_at();
create trigger opportunities_updated_at before update on public.opportunities for each row execute function private.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function private.set_updated_at();

create trigger companies_soft_delete before update on public.companies for each row execute function private.guard_soft_delete();
create trigger contacts_soft_delete before update on public.contacts for each row execute function private.guard_soft_delete();
create trigger leads_soft_delete before update on public.leads for each row execute function private.guard_soft_delete();
create trigger companies_audit_delete after update on public.companies for each row execute function private.audit_soft_delete();
create trigger contacts_audit_delete after update on public.contacts for each row execute function private.audit_soft_delete();
create trigger leads_audit_delete after update on public.leads for each row execute function private.audit_soft_delete();

-- Configuração comercial e consentimento entram na auditoria completa.
create trigger lead_sources_audit after insert or update or delete on public.lead_sources for each row execute function private.audit_change();
create trigger pipelines_audit after insert or update or delete on public.pipelines for each row execute function private.audit_change();
create trigger pipeline_stages_audit after insert or update or delete on public.pipeline_stages for each row execute function private.audit_change();
create trigger tags_audit after insert or update or delete on public.tags for each row execute function private.audit_change();
create trigger suppression_list_audit after insert or delete on public.suppression_list for each row execute function private.audit_change();

-- Lead: data da etapa, histórico de mudança de etapa e marca de vencedor.
create function private.lead_stage_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_from text;
  v_to text;
begin
  if tg_op = 'INSERT' then
    insert into public.activities (tenant_id, lead_id, contact_id, kind, body, actor_type, actor_id)
    values (new.tenant_id, new.id, new.contact_id, 'system', 'Lead criado.', case when (select auth.uid()) is null then 'system' else 'user' end, (select auth.uid()));
    return new;
  end if;
  if new.stage_id is distinct from old.stage_id then
    select name into v_from from public.pipeline_stages where id = old.stage_id;
    select name into v_to from public.pipeline_stages where id = new.stage_id;
    insert into public.activities (tenant_id, lead_id, contact_id, kind, body, metadata, actor_type, actor_id)
    values (new.tenant_id, new.id, new.contact_id, 'stage_change', format('Etapa: %s → %s', v_from, v_to),
            jsonb_build_object('from_stage_id', old.stage_id, 'to_stage_id', new.stage_id),
            case when (select auth.uid()) is null then 'system' else 'user' end, (select auth.uid()));
  end if;
  return new;
end;
$$;

create function private.lead_stage_timestamp()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger leads_stage_timestamp before update on public.leads for each row execute function private.lead_stage_timestamp();
create trigger leads_stage_activity after insert or update of stage_id on public.leads for each row execute function private.lead_stage_change();

-- Oportunidade: data de fechamento acompanha o status.
create function private.opportunity_closed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'open' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or new.status is distinct from old.status then
    new.closed_at := now();
  end if;
  return new;
end;
$$;
create trigger opportunities_closed_at before insert or update on public.opportunities for each row execute function private.opportunity_closed_at();

create function private.task_completed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) else null end;
  return new;
end;
$$;
create trigger tasks_completed_at before insert or update on public.tasks for each row execute function private.task_completed_at();

-- Autor das linhas imutáveis vem da sessão, nunca do cliente.
create function private.stamp_actor()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_table_name = 'activities' then
      new.actor_type := 'user';
      new.actor_id := (select auth.uid());
    elsif tg_table_name = 'consent_records' then
      new.recorded_by := (select auth.uid());
      new.recorded_at := now();
    else
      new.created_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;
create trigger activities_actor before insert on public.activities for each row execute function private.stamp_actor();
create trigger consent_records_actor before insert on public.consent_records for each row execute function private.stamp_actor();
create trigger suppression_actor before insert on public.suppression_list for each row execute function private.stamp_actor();
create trigger companies_actor before insert on public.companies for each row execute function private.stamp_actor();
create trigger contacts_actor before insert on public.contacts for each row execute function private.stamp_actor();
create trigger leads_actor before insert on public.leads for each row execute function private.stamp_actor();
create trigger opportunities_actor before insert on public.opportunities for each row execute function private.stamp_actor();
create trigger tasks_actor before insert on public.tasks for each row execute function private.stamp_actor();
create trigger imports_actor before insert on public.imports for each row execute function private.stamp_actor();

-- Mudança de consentimento aparece na linha do tempo do contato.
create function private.consent_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activities (tenant_id, contact_id, kind, body, metadata, actor_type, actor_id)
  values (new.tenant_id, new.contact_id, 'consent_change',
          format('Consentimento %s: %s / %s (%s)', case when new.status = 'granted' then 'registrado' else 'revogado' end, new.channel, new.purpose, new.source),
          jsonb_build_object('consent_id', new.id, 'status', new.status, 'channel', new.channel, 'purpose', new.purpose),
          case when new.recorded_by is null then 'system' else 'user' end, new.recorded_by);
  return new;
end;
$$;
create trigger consent_records_activity after insert on public.consent_records for each row execute function private.consent_activity();

-- ---------------------------------------------------------------------------
-- Padrões de cada empresa: pipeline e origens
-- ---------------------------------------------------------------------------

create function private.seed_crm_defaults(p_tenant uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pipeline uuid;
begin
  if exists (select 1 from public.pipelines where tenant_id = p_tenant) then
    return;
  end if;
  insert into public.pipelines (tenant_id, name, is_default) values (p_tenant, 'Comercial', true) returning id into v_pipeline;
  insert into public.pipeline_stages (tenant_id, pipeline_id, name, position, is_qualified, is_won, is_lost, color) values
    (p_tenant, v_pipeline, 'Novo', 0, false, false, false, 'slate'),
    (p_tenant, v_pipeline, 'Em análise', 1, false, false, false, 'blue'),
    (p_tenant, v_pipeline, 'Contato autorizado', 2, false, false, false, 'cyan'),
    (p_tenant, v_pipeline, 'Em atendimento', 3, false, false, false, 'blue'),
    (p_tenant, v_pipeline, 'Qualificado', 4, true, false, false, 'violet'),
    (p_tenant, v_pipeline, 'Proposta', 5, true, false, false, 'violet'),
    (p_tenant, v_pipeline, 'Negociação', 6, true, false, false, 'amber'),
    (p_tenant, v_pipeline, 'Ganho', 7, true, true, false, 'emerald'),
    (p_tenant, v_pipeline, 'Perdido', 8, false, false, true, 'red');
  insert into public.lead_sources (tenant_id, name, kind) values
    (p_tenant, 'Cadastro manual', 'manual'),
    (p_tenant, 'Formulário do site', 'form'),
    (p_tenant, 'Importação CSV', 'csv'),
    (p_tenant, 'WhatsApp (entrada)', 'whatsapp_inbound'),
    (p_tenant, 'Indicação', 'referral');
end;
$$;

create function private.organization_crm_defaults()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.seed_crm_defaults(new.id);
  return new;
end;
$$;
create trigger organizations_crm_defaults after insert on public.organizations for each row execute function private.organization_crm_defaults();

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform private.seed_crm_defaults(v_org.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Importação de contatos e leads (chamada com a sessão do usuário: o RLS vale)
-- ---------------------------------------------------------------------------

-- p_rows: [{full_name, phone_e164, email, company_name, company_document,
-- job_title, city, state, tags: [..], consent_whatsapp: bool}], já
-- normalizados e validados no servidor. Deduplica por telefone e e-mail;
-- contato existente só recebe campos que estavam vazios.
create function public.import_contacts(
  p_tenant uuid,
  p_file_name text,
  p_declared_origin text,
  p_source uuid,
  p_rows jsonb,
  p_create_leads boolean,
  p_consent_declared boolean,
  p_rejected jsonb default '[]'
)
returns public.imports
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row jsonb;
  v_contact uuid;
  v_company uuid;
  v_existing public.contacts;
  v_pipeline uuid;
  v_stage uuid;
  v_tag text;
  v_tag_id uuid;
  v_import public.imports;
  v_created integer := 0;
  v_updated integer := 0;
  v_leads integer := 0;
begin
  if not private.has_org_role(p_tenant, 'manager') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'too_many_rows' using errcode = '22023';
  end if;

  select p.id, s.id into v_pipeline, v_stage
  from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
  where p.tenant_id = p_tenant and p.is_default
  order by s.position limit 1;

  insert into public.imports (tenant_id, file_name, lead_source_id, declared_origin, consent_declared, total_rows, rejected_rows, errors)
  values (p_tenant, p_file_name, p_source, p_declared_origin, p_consent_declared,
          jsonb_array_length(p_rows) + jsonb_array_length(p_rejected), jsonb_array_length(p_rejected), p_rejected)
  returning * into v_import;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_company := null;
    if nullif(v_row ->> 'company_document', '') is not null then
      select id into v_company from public.companies
      where tenant_id = p_tenant and document = v_row ->> 'company_document' and deleted_at is null;
    end if;
    if v_company is null and nullif(v_row ->> 'company_name', '') is not null then
      select id into v_company from public.companies
      where tenant_id = p_tenant and lower(name) = lower(v_row ->> 'company_name') and deleted_at is null limit 1;
    end if;
    if v_company is null and nullif(v_row ->> 'company_name', '') is not null then
      insert into public.companies (tenant_id, name, document, provenance)
      values (p_tenant, v_row ->> 'company_name', nullif(v_row ->> 'company_document', ''),
              jsonb_build_object('import', jsonb_build_object('id', v_import.id, 'origin', p_declared_origin, 'at', now())))
      returning id into v_company;
    end if;

    select * into v_existing from public.contacts
    where tenant_id = p_tenant and deleted_at is null
      and ((phone_e164 is not null and phone_e164 = v_row ->> 'phone_e164')
        or (email_normalized is not null and email_normalized = lower(v_row ->> 'email')))
    limit 1;

    if v_existing.id is null then
      insert into public.contacts (tenant_id, full_name, phone_e164, email, company_id, job_title, city, state, provenance)
      values (p_tenant, v_row ->> 'full_name', nullif(v_row ->> 'phone_e164', ''), nullif(v_row ->> 'email', ''), v_company,
              nullif(v_row ->> 'job_title', ''), nullif(v_row ->> 'city', ''), nullif(v_row ->> 'state', ''),
              jsonb_build_object('import', jsonb_build_object('id', v_import.id, 'origin', p_declared_origin, 'at', now())))
      returning id into v_contact;
      v_created := v_created + 1;
    else
      v_contact := v_existing.id;
      update public.contacts set
        phone_e164 = coalesce(phone_e164, nullif(v_row ->> 'phone_e164', '')),
        email = coalesce(email, nullif(v_row ->> 'email', '')),
        company_id = coalesce(company_id, v_company),
        job_title = coalesce(job_title, nullif(v_row ->> 'job_title', '')),
        city = coalesce(city, nullif(v_row ->> 'city', '')),
        state = coalesce(state, nullif(v_row ->> 'state', ''))
      where id = v_contact;
      v_updated := v_updated + 1;
    end if;
    v_existing := null;

    for v_tag in select jsonb_array_elements_text(coalesce(v_row -> 'tags', '[]')) loop
      select id into v_tag_id from public.tags where tenant_id = p_tenant and lower(name) = lower(v_tag);
      if v_tag_id is null then
        insert into public.tags (tenant_id, name) values (p_tenant, v_tag) returning id into v_tag_id;
      end if;
      insert into public.contact_tags (tenant_id, contact_id, tag_id) values (p_tenant, v_contact, v_tag_id) on conflict do nothing;
      v_tag_id := null;
    end loop;

    if p_consent_declared and coalesce((v_row ->> 'consent_whatsapp')::boolean, false) then
      insert into public.consent_records (tenant_id, contact_id, channel, purpose, legal_basis, status, source, evidence)
      values (p_tenant, v_contact, 'whatsapp', 'marketing', 'consent', 'granted', 'Importação CSV: ' || p_file_name,
              jsonb_build_object('kind', 'import_declaration', 'import_id', v_import.id, 'declared_origin', p_declared_origin));
    end if;

    if p_create_leads and v_pipeline is not null and not exists (
      select 1 from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
      where l.tenant_id = p_tenant and l.contact_id = v_contact and l.deleted_at is null and not s.is_won and not s.is_lost
    ) then
      insert into public.leads (tenant_id, contact_id, company_id, lead_source_id, pipeline_id, stage_id)
      values (p_tenant, v_contact, v_company, p_source, v_pipeline, v_stage);
      v_leads := v_leads + 1;
    end if;
  end loop;

  update public.imports set created_contacts = v_created, updated_contacts = v_updated, created_leads = v_leads
  where id = v_import.id returning * into v_import;
  return v_import;
end;
$$;

-- Registro de exportação (auditoria): só gestor ou acima.
create function public.record_export(p_tenant uuid, p_entity text, p_rows integer, p_filters jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_org_role(p_tenant, 'manager') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.audit_logs (tenant_id, actor_type, actor_id, action, entity_type, diff)
  values (p_tenant, 'user', (select auth.uid()), 'export', p_entity, jsonb_build_object('rows', p_rows, 'filters', p_filters));
end;
$$;

-- ---------------------------------------------------------------------------
-- Indicadores do dashboard (definições em docs/ai-sales/ARCHITECTURE.md §7)
-- security invoker: o RLS do usuário vale (vendedor vê só o que pode).
-- ---------------------------------------------------------------------------

create function public.crm_dashboard(p_tenant uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with period_leads as (
    select l.* from public.leads l
    where l.tenant_id = p_tenant and l.deleted_at is null and l.created_at >= p_from and l.created_at < p_to
  )
  select jsonb_build_object(
    'leads_created', (select count(*) from period_leads),
    'leads_by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', coalesce(s.name, 'Sem origem'), 'count', x.n) order by x.n desc)
      from (select lead_source_id, count(*) n from period_leads group by lead_source_id) x
      left join public.lead_sources s on s.id = x.lead_source_id
    ), '[]'::jsonb),
    'leads_authorized', (
      select count(*) from public.leads l
      join public.contacts c on c.id = l.contact_id
      where l.tenant_id = p_tenant and l.deleted_at is null and l.created_at < p_to
        and exists (select 1 from public.current_consents cc where cc.tenant_id = p_tenant and cc.contact_id = c.id and cc.channel = 'whatsapp' and cc.is_valid)
        and (c.phone_e164 is null or not exists (select 1 from public.suppression_list sl where sl.tenant_id = p_tenant and sl.channel = 'whatsapp' and sl.identifier = c.phone_e164))
    ),
    'leads_qualified', (
      select count(distinct a.lead_id) from public.activities a
      join public.pipeline_stages s on s.id = (a.metadata ->> 'to_stage_id')::uuid
      join public.leads l on l.id = a.lead_id and l.deleted_at is null
      where a.tenant_id = p_tenant and a.kind = 'stage_change' and s.is_qualified and a.created_at >= p_from and a.created_at < p_to
    ),
    'opportunities_open', (select count(*) from public.opportunities o where o.tenant_id = p_tenant and o.status = 'open' and o.created_at < p_to),
    'opportunities_won', (select count(*) from public.opportunities o where o.tenant_id = p_tenant and o.status = 'won' and o.closed_at >= p_from and o.closed_at < p_to),
    'opportunities_lost', (select count(*) from public.opportunities o where o.tenant_id = p_tenant and o.status = 'lost' and o.closed_at >= p_from and o.closed_at < p_to),
    'won_amount_cents', (select coalesce(sum(o.amount_cents), 0) from public.opportunities o where o.tenant_id = p_tenant and o.status = 'won' and o.closed_at >= p_from and o.closed_at < p_to),
    'tasks_overdue', (select count(*) from public.tasks t where t.tenant_id = p_tenant and t.status = 'open' and t.due_at < now())
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.lead_sources enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.tags enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_tags enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.consent_records enable row level security;
alter table public.suppression_list enable row level security;
alter table public.imports enable row level security;

revoke all on public.lead_sources, public.pipelines, public.pipeline_stages, public.tags, public.companies,
  public.contacts, public.contact_tags, public.leads, public.opportunities, public.activities, public.tasks,
  public.consent_records, public.suppression_list, public.imports, public.current_consents from anon, authenticated;

grant select on public.lead_sources, public.pipelines, public.pipeline_stages, public.tags, public.companies,
  public.contacts, public.contact_tags, public.leads, public.opportunities, public.activities, public.tasks,
  public.consent_records, public.suppression_list, public.imports, public.current_consents to authenticated;
grant insert, update, delete on public.lead_sources, public.pipelines, public.pipeline_stages, public.tags,
  public.contact_tags, public.tasks, public.opportunities to authenticated;
-- Sem delete físico de CRM pelo app: exclusão é lógica (deleted_at).
grant insert, update on public.companies, public.contacts, public.leads to authenticated;
-- Registros imutáveis: só inserção.
grant insert on public.activities, public.consent_records to authenticated;
grant insert, delete on public.suppression_list to authenticated;
grant all on public.lead_sources, public.pipelines, public.pipeline_stages, public.tags, public.companies,
  public.contacts, public.contact_tags, public.leads, public.opportunities, public.activities, public.tasks,
  public.consent_records, public.suppression_list, public.imports, public.current_consents to service_role;

-- Configuração comercial: todos leem, gestor ou acima altera.
create policy "membros leem origens" on public.lead_sources for select to authenticated using (private.is_member(tenant_id));
create policy "gestor gerencia origens" on public.lead_sources for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "membros leem pipelines" on public.pipelines for select to authenticated using (private.is_member(tenant_id));
create policy "gestor gerencia pipelines" on public.pipelines for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "membros leem etapas" on public.pipeline_stages for select to authenticated using (private.is_member(tenant_id));
create policy "gestor gerencia etapas" on public.pipeline_stages for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "membros leem tags" on public.tags for select to authenticated using (private.is_member(tenant_id));
create policy "vendedor cria tags" on public.tags for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "gestor altera tags" on public.tags for update to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "gestor remove tags" on public.tags for delete to authenticated using (private.has_org_role(tenant_id, 'manager'));

-- Empresas e contatos: visíveis a todos os membros; vendedor cria e edita.
create policy "membros leem empresas" on public.companies for select to authenticated
  using (private.is_member(tenant_id) and (deleted_at is null or private.has_org_role(tenant_id, 'manager')));
create policy "vendedor cria empresas" on public.companies for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "vendedor edita empresas" on public.companies for update to authenticated
  using (private.has_org_role(tenant_id, 'sales')) with check (private.has_org_role(tenant_id, 'sales'));

create policy "membros leem contatos" on public.contacts for select to authenticated
  using (private.is_member(tenant_id) and (deleted_at is null or private.has_org_role(tenant_id, 'manager')));
create policy "vendedor cria contatos" on public.contacts for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "vendedor edita contatos" on public.contacts for update to authenticated
  using (private.has_org_role(tenant_id, 'sales')) with check (private.has_org_role(tenant_id, 'sales'));

create policy "membros leem tags de contatos" on public.contact_tags for select to authenticated using (private.is_member(tenant_id));
create policy "vendedor marca contatos" on public.contact_tags for all to authenticated
  using (private.has_org_role(tenant_id, 'sales')) with check (private.has_org_role(tenant_id, 'sales'));

-- Leads: visibilidade do vendedor conforme a empresa.
create policy "leads visíveis" on public.leads for select to authenticated
  using (private.can_see_lead(tenant_id, owner_user_id) and (deleted_at is null or private.has_org_role(tenant_id, 'manager')));
create policy "vendedor cria leads" on public.leads for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "vendedor edita leads visíveis" on public.leads for update to authenticated
  using (private.has_org_role(tenant_id, 'sales') and private.can_see_lead(tenant_id, owner_user_id))
  with check (private.has_org_role(tenant_id, 'sales') and private.can_see_lead(tenant_id, owner_user_id));

create policy "oportunidades dos leads visíveis" on public.opportunities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "vendedor gerencia oportunidades" on public.opportunities for all to authenticated
  using (private.has_org_role(tenant_id, 'sales') and exists (select 1 from public.leads l where l.id = lead_id))
  with check (private.has_org_role(tenant_id, 'sales') and exists (select 1 from public.leads l where l.id = lead_id));

create policy "atividades visíveis" on public.activities for select to authenticated
  using (private.is_member(tenant_id) and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)));
create policy "vendedor registra atividades" on public.activities for insert to authenticated
  with check (private.has_org_role(tenant_id, 'sales') and kind in ('note', 'call', 'email', 'meeting')
              and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)));

create policy "tarefas visíveis" on public.tasks for select to authenticated
  using (private.is_member(tenant_id) and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)));
create policy "vendedor cria tarefas" on public.tasks for insert to authenticated
  with check (private.has_org_role(tenant_id, 'sales') and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)));
create policy "vendedor altera tarefas" on public.tasks for update to authenticated
  using (private.has_org_role(tenant_id, 'sales') and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)))
  with check (private.has_org_role(tenant_id, 'sales'));
create policy "vendedor remove tarefas" on public.tasks for delete to authenticated
  using (private.has_org_role(tenant_id, 'sales') and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id)));

create policy "membros leem consentimentos" on public.consent_records for select to authenticated using (private.is_member(tenant_id));
create policy "vendedor registra consentimento" on public.consent_records for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));

create policy "membros leem supressão" on public.suppression_list for select to authenticated using (private.is_member(tenant_id));
-- Qualquer vendedor registra descadastro; só admin remove (e fica auditado).
create policy "vendedor registra supressão" on public.suppression_list for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "admin remove supressão" on public.suppression_list for delete to authenticated using (private.has_org_role(tenant_id, 'admin'));

create policy "gestor vê importações" on public.imports for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor importa" on public.imports for insert to authenticated with check (private.has_org_role(tenant_id, 'manager'));
create policy "gestor atualiza importação" on public.imports for update to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
grant update (created_contacts, updated_contacts, created_leads) on public.imports to authenticated;
grant insert on public.imports to authenticated;

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Funções novas já nascem sem EXECUTE (default privileges da Fase 1).
grant execute on function private.can_see_lead(uuid, uuid) to authenticated, service_role;
grant execute on function public.import_contacts(uuid, text, text, uuid, jsonb, boolean, boolean, jsonb),
  public.record_export(uuid, text, integer, jsonb),
  public.crm_dashboard(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
