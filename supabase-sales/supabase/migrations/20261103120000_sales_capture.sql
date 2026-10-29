-- PeriniHub AI Sales — Fase 6: captação e enriquecimento.
--
-- Formulários públicos com consentimento de texto versionado e evidência por
-- envio; enriquecimento de empresas pelo CNPJ com proveniência por campo; e o
-- estágio de descoberta do lead (empresa identificada → contato encontrado →
-- autorizado → oportunidade) passa a ser calculado pelo banco: só um
-- consentimento válido leva a "autorizado" — telefone descoberto nunca.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.capture_form_status as enum ('draft', 'active', 'paused');
create type public.enrichment_status as enum ('success', 'not_found', 'error');

-- ---------------------------------------------------------------------------
-- Empresas: campos que o enriquecimento preenche
-- ---------------------------------------------------------------------------

alter table public.companies
  add column trade_name text check (trade_name is null or char_length(trade_name) <= 200),
  add column registration_status text check (registration_status is null or char_length(registration_status) <= 40),
  add column size text check (size is null or char_length(size) <= 60),
  add column opened_on date,
  add column enriched_at timestamptz;

-- ---------------------------------------------------------------------------
-- Formulários de captação
-- ---------------------------------------------------------------------------

create table public.capture_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  -- Identificador público do link (não é segredo, mas não é sequencial).
  public_key text not null unique default replace(gen_random_uuid()::text, '-', '') check (public_key ~ '^[a-z0-9]{32}$'),
  name text not null check (char_length(name) between 2 and 80),
  headline text not null check (char_length(headline) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  -- Campos pedidos além do nome. Telefone ou e-mail: ao menos um.
  fields text[] not null default '{phone,email}'
    check (fields <@ array['phone', 'email', 'company', 'job_title', 'message']::text[] and fields && array['phone', 'email']::text[]),
  consent_text text not null check (char_length(consent_text) between 20 and 2000),
  consent_channels public.consent_channel[] not null default '{whatsapp}' check (cardinality(consent_channels) between 1 and 3),
  consent_purposes public.consent_purpose[] not null default '{sales_followup}' check (cardinality(consent_purposes) between 1 and 4),
  -- Muda sozinha quando o texto, os canais ou as finalidades mudam.
  consent_version integer not null default 1,
  success_message text not null default 'Recebemos seus dados. Em breve entraremos em contato.' check (char_length(success_message) between 2 and 300),
  lead_source_id uuid,
  status public.capture_form_status not null default 'draft',
  submissions_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, lead_source_id) references public.lead_sources (tenant_id, id) on delete set null (lead_source_id),
  unique (tenant_id, id)
);
create index capture_forms_tenant_idx on public.capture_forms (tenant_id, created_at desc);

-- Texto exato apresentado em cada versão: a evidência do envio aponta para cá.
create table public.capture_form_consent_versions (
  tenant_id uuid not null,
  form_id uuid not null,
  version integer not null,
  consent_text text not null,
  consent_channels public.consent_channel[] not null,
  consent_purposes public.consent_purpose[] not null,
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, form_id, version),
  foreign key (tenant_id, form_id) references public.capture_forms (tenant_id, id) on delete cascade
);

-- Um envio = uma linha. Sem cópia dos dados pessoais: eles vão para o
-- contato (com proveniência); aqui fica a prova (hash, versão, IP em hash).
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  form_id uuid not null,
  contact_id uuid,
  lead_id uuid,
  consent_given boolean not null,
  consent_version integer not null,
  fields_received text[] not null default '{}',
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, form_id) references public.capture_forms (tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete set null (contact_id),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete set null (lead_id),
  unique (tenant_id, id)
);
create index form_submissions_form_idx on public.form_submissions (tenant_id, form_id, created_at desc);
create index form_submissions_contact_idx on public.form_submissions (tenant_id, contact_id);

-- ---------------------------------------------------------------------------
-- Enriquecimento
-- ---------------------------------------------------------------------------

-- Histórico de consultas. `data` guarda só os campos da empresa usados (sem
-- sócios, telefone ou e-mail cadastrais: podem ser de pessoa física).
create table public.company_enrichments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid,
  source text not null check (source in ('brasilapi_cnpj')),
  document text not null check (document ~ '^[0-9]{14}$'),
  status public.enrichment_status not null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  applied_fields text[] not null default '{}',
  fetched_by uuid references auth.users (id) on delete set null,
  fetched_at timestamptz not null default now(),
  foreign key (tenant_id, company_id) references public.companies (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);
create index company_enrichments_company_idx on public.company_enrichments (tenant_id, company_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- Triggers dos formulários
-- ---------------------------------------------------------------------------

create trigger capture_forms_updated_at before update on public.capture_forms for each row execute function private.set_updated_at();
create trigger capture_forms_actor before insert on public.capture_forms for each row execute function private.stamp_actor();
-- O contador de envios fica fora da auditoria (mudaria a cada envio).
create trigger capture_forms_audit after insert or delete or update of name, headline, description, fields, consent_text, consent_channels,
  consent_purposes, success_message, lead_source_id, status on public.capture_forms for each row execute function private.audit_change();

create function private.capture_form_consent_version()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.consent_version := 1;
    new.submissions_count := 0;
  else
    if new.tenant_id <> old.tenant_id or new.public_key <> old.public_key then
      raise exception 'immutable_form' using errcode = '42501';
    end if;
    if new.consent_text is distinct from old.consent_text
       or new.consent_channels is distinct from old.consent_channels
       or new.consent_purposes is distinct from old.consent_purposes then
      new.consent_version := old.consent_version + 1;
    else
      new.consent_version := old.consent_version;
    end if;
    -- Contador só muda pelo envio (função do servidor).
    if not private.is_service_role() then
      new.submissions_count := old.submissions_count;
    end if;
  end if;
  return new;
end;
$$;
create trigger capture_forms_consent_version before insert or update on public.capture_forms
  for each row execute function private.capture_form_consent_version();

create function private.capture_form_record_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.capture_form_consent_versions (tenant_id, form_id, version, consent_text, consent_channels, consent_purposes, text_hash)
  values (new.tenant_id, new.id, new.consent_version, new.consent_text, new.consent_channels, new.consent_purposes,
          encode(sha256(convert_to(new.consent_text, 'UTF8')), 'hex'))
  on conflict do nothing;
  return new;
end;
$$;
create trigger capture_forms_record_version after insert or update on public.capture_forms
  for each row execute function private.capture_form_record_version();

-- stamp_actor grava created_by; no enriquecimento o autor é fetched_by.
create function private.stamp_fetched_by()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.fetched_by := (select auth.uid());
    new.fetched_at := now();
  end if;
  return new;
end;
$$;
create trigger company_enrichments_actor before insert on public.company_enrichments for each row execute function private.stamp_fetched_by();

-- ---------------------------------------------------------------------------
-- Estágio de descoberta calculado
-- ---------------------------------------------------------------------------

-- company_identified: lead só com empresa; contact_found: há contato;
-- contact_authorized: o contato tem consentimento válido em algum canal;
-- qualified_opportunity: autorizado e numa etapa qualificada do pipeline.
create function private.compute_discovery_stage(p_tenant uuid, p_contact uuid, p_stage uuid)
returns public.discovery_stage
language sql stable security definer set search_path = ''
as $$
  select case
    when p_contact is null then 'company_identified'
    when not exists (
      select 1 from public.current_consents cc
      where cc.tenant_id = p_tenant and cc.contact_id = p_contact and cc.is_valid
    ) then 'contact_found'
    when exists (select 1 from public.pipeline_stages s where s.id = p_stage and s.is_qualified) then 'qualified_opportunity'
    else 'contact_authorized'
  end::public.discovery_stage
$$;

create function private.lead_discovery_stage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.discovery_stage := private.compute_discovery_stage(new.tenant_id, new.contact_id, new.stage_id);
  return new;
end;
$$;
create trigger leads_discovery_stage before insert or update of contact_id, stage_id, discovery_stage on public.leads
  for each row execute function private.lead_discovery_stage();

-- Consentimento novo (concessão ou revogação) recalcula os leads do contato.
create function private.consent_refresh_discovery()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.leads l
  set discovery_stage = private.compute_discovery_stage(l.tenant_id, l.contact_id, l.stage_id)
  where l.tenant_id = new.tenant_id and l.contact_id = new.contact_id and l.deleted_at is null
    and l.discovery_stage is distinct from private.compute_discovery_stage(l.tenant_id, l.contact_id, l.stage_id);
  return new;
end;
$$;
create trigger consent_records_discovery after insert on public.consent_records
  for each row execute function private.consent_refresh_discovery();

-- Leads existentes passam a seguir a regra.
update public.leads l
set discovery_stage = private.compute_discovery_stage(l.tenant_id, l.contact_id, l.stage_id)
where l.discovery_stage is distinct from private.compute_discovery_stage(l.tenant_id, l.contact_id, l.stage_id);

-- ---------------------------------------------------------------------------
-- Origem "Prospecção" (pesquisa em dados públicos) para todas as empresas
-- ---------------------------------------------------------------------------

create function private.seed_research_source(p_tenant uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.lead_sources (tenant_id, name, kind)
  select p_tenant, 'Prospecção (dados públicos)', 'research'
  where not exists (select 1 from public.lead_sources where tenant_id = p_tenant and kind = 'research')
  on conflict do nothing
$$;

create function private.organization_research_source()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.seed_research_source(new.id);
  return new;
end;
$$;
create trigger organizations_research_source after insert on public.organizations
  for each row execute function private.organization_research_source();

select private.seed_research_source(id) from public.organizations;

-- ---------------------------------------------------------------------------
-- Envio de formulário (só o servidor, com a secret key)
-- ---------------------------------------------------------------------------

-- Os dados chegam validados e normalizados pela rota pública (Zod +
-- libphonenumber). Deduplica o contato por telefone/e-mail, preenche só campos
-- vazios (com proveniência), registra o consentimento por canal × finalidade
-- com a evidência do envio e cria o lead se não houver um aberto.
create function public.capture_form_submit(
  p_public_key text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_company text,
  p_job_title text,
  p_message text,
  p_consent boolean,
  p_consent_version integer,
  p_payload_hash text,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_form public.capture_forms;
  v_version public.capture_form_consent_versions;
  v_now timestamptz := now();
  v_origin jsonb;
  v_contact public.contacts;
  v_company uuid;
  v_source uuid;
  v_pipeline uuid;
  v_stage uuid;
  v_lead uuid;
  v_submission uuid;
  v_channel public.consent_channel;
  v_purpose public.consent_purpose;
  v_identifier text;
  v_provenance jsonb := '{}';
  v_received text[] := '{}';
begin
  select f.* into v_form
  from public.capture_forms f join public.organizations o on o.id = f.tenant_id
  where f.public_key = p_public_key and f.status = 'active' and o.status = 'active';
  if v_form.id is null then
    raise exception 'form_unavailable' using errcode = 'P0002';
  end if;
  -- O titular precisa ter visto o texto vigente.
  if p_consent_version is distinct from v_form.consent_version then
    raise exception 'consent_version_changed' using errcode = '22023';
  end if;
  if nullif(btrim(p_full_name), '') is null then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if p_phone_e164 is null and p_email is null then
    raise exception 'contact_required' using errcode = '22023';
  end if;
  select * into v_version from public.capture_form_consent_versions
  where tenant_id = v_form.tenant_id and form_id = v_form.id and version = v_form.consent_version;

  v_origin := jsonb_build_object('source', 'form', 'form_id', v_form.id, 'at', v_now);

  insert into public.form_submissions (tenant_id, form_id, consent_given, consent_version, payload_hash, ip_hash, user_agent)
  values (v_form.tenant_id, v_form.id, coalesce(p_consent, false), v_form.consent_version, p_payload_hash, p_ip_hash, left(p_user_agent, 300))
  returning id into v_submission;
  v_origin := v_origin || jsonb_build_object('submission_id', v_submission);

  -- Empresa informada pelo próprio titular.
  if nullif(btrim(p_company), '') is not null then
    select id into v_company from public.companies
    where tenant_id = v_form.tenant_id and lower(name) = lower(btrim(p_company)) and deleted_at is null limit 1;
    if v_company is null then
      insert into public.companies (tenant_id, name, provenance)
      values (v_form.tenant_id, btrim(p_company), jsonb_build_object('name', v_origin))
      returning id into v_company;
    end if;
  end if;

  select * into v_contact from public.contacts
  where tenant_id = v_form.tenant_id and deleted_at is null
    and ((p_phone_e164 is not null and phone_e164 = p_phone_e164)
      or (p_email is not null and email_normalized = lower(btrim(p_email))))
  order by (phone_e164 is not distinct from p_phone_e164) desc, created_at
  limit 1;

  if v_contact.id is null then
    if p_phone_e164 is not null then v_provenance := v_provenance || jsonb_build_object('phone_e164', v_origin); end if;
    if p_email is not null then v_provenance := v_provenance || jsonb_build_object('email', v_origin); end if;
    if p_job_title is not null then v_provenance := v_provenance || jsonb_build_object('job_title', v_origin); end if;
    if v_company is not null then v_provenance := v_provenance || jsonb_build_object('company_id', v_origin); end if;
    insert into public.contacts (tenant_id, full_name, phone_e164, email, company_id, job_title, provenance)
    values (v_form.tenant_id, btrim(p_full_name), p_phone_e164, p_email, v_company, p_job_title,
            v_provenance || jsonb_build_object('full_name', v_origin))
    returning * into v_contact;
  else
    -- Contato existente: só completa o que está vazio (e registra a origem disso).
    if v_contact.phone_e164 is null and p_phone_e164 is not null
       and not exists (select 1 from public.contacts c where c.tenant_id = v_form.tenant_id and c.phone_e164 = p_phone_e164 and c.deleted_at is null) then
      v_provenance := v_provenance || jsonb_build_object('phone_e164', v_origin);
    end if;
    if v_contact.email is null and p_email is not null
       and not exists (select 1 from public.contacts c where c.tenant_id = v_form.tenant_id and c.email_normalized = lower(btrim(p_email)) and c.deleted_at is null) then
      v_provenance := v_provenance || jsonb_build_object('email', v_origin);
    end if;
    if v_contact.job_title is null and p_job_title is not null then v_provenance := v_provenance || jsonb_build_object('job_title', v_origin); end if;
    if v_contact.company_id is null and v_company is not null then v_provenance := v_provenance || jsonb_build_object('company_id', v_origin); end if;
    update public.contacts set
      phone_e164 = case when v_provenance ? 'phone_e164' then p_phone_e164 else phone_e164 end,
      email = case when v_provenance ? 'email' then p_email else email end,
      job_title = coalesce(job_title, p_job_title),
      company_id = coalesce(company_id, v_company),
      provenance = provenance || v_provenance
    where id = v_contact.id
    returning * into v_contact;
  end if;

  -- Consentimento: um registro por canal × finalidade, só onde há identificador.
  if coalesce(p_consent, false) then
    foreach v_channel in array v_form.consent_channels loop
      v_identifier := case when v_channel = 'email' then v_contact.email else v_contact.phone_e164 end;
      continue when v_identifier is null;
      foreach v_purpose in array v_form.consent_purposes loop
        insert into public.consent_records (tenant_id, contact_id, channel, purpose, legal_basis, status, source, evidence)
        values (v_form.tenant_id, v_contact.id, v_channel, v_purpose, 'consent', 'granted', left('Formulário: ' || v_form.name, 200),
                jsonb_build_object('kind', 'form_submission', 'submission_id', v_submission, 'form_id', v_form.id,
                                   'text_version', v_form.consent_version, 'text_hash', v_version.text_hash,
                                   'payload_hash', p_payload_hash, 'ip_hash', p_ip_hash, 'captured_at', v_now));
      end loop;
    end loop;
  end if;

  -- Lead: reaproveita um aberto; senão cria na primeira etapa do pipeline padrão.
  select l.id into v_lead from public.leads l
  join public.pipeline_stages s on s.id = l.stage_id
  where l.tenant_id = v_form.tenant_id and l.contact_id = v_contact.id and l.deleted_at is null and not s.is_won and not s.is_lost
  order by l.created_at desc limit 1;

  if v_lead is null then
    v_source := v_form.lead_source_id;
    if v_source is null then
      select id into v_source from public.lead_sources
      where tenant_id = v_form.tenant_id and kind = 'form' and active order by created_at limit 1;
    end if;
    select p.id, s.id into v_pipeline, v_stage
    from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
    where p.tenant_id = v_form.tenant_id and p.is_default
    order by s.position limit 1;
    if v_pipeline is not null then
      insert into public.leads (tenant_id, contact_id, company_id, lead_source_id, pipeline_id, stage_id, title)
      values (v_form.tenant_id, v_contact.id, coalesce(v_contact.company_id, v_company), v_source, v_pipeline, v_stage, left('Formulário: ' || v_form.name, 160))
      returning id into v_lead;
    end if;
  end if;

  if p_phone_e164 is not null then v_received := array_append(v_received, 'phone'); end if;
  if p_email is not null then v_received := array_append(v_received, 'email'); end if;
  if p_company is not null then v_received := array_append(v_received, 'company'); end if;
  if p_job_title is not null then v_received := array_append(v_received, 'job_title'); end if;
  if p_message is not null then v_received := array_append(v_received, 'message'); end if;

  insert into public.activities (tenant_id, lead_id, contact_id, kind, body, metadata, actor_type)
  values (v_form.tenant_id, v_lead, v_contact.id, 'system',
          left(format('Formulário "%s" enviado%s.%s', v_form.name,
                      case when coalesce(p_consent, false) then ' com consentimento' else ' sem consentimento' end,
                      case when p_message is not null then E'\n\nMensagem: ' || p_message else '' end), 4000),
          jsonb_build_object('form_id', v_form.id, 'submission_id', v_submission), 'system');

  update public.form_submissions set contact_id = v_contact.id, lead_id = v_lead, fields_received = v_received
  where id = v_submission;
  update public.capture_forms set submissions_count = submissions_count + 1 where id = v_form.id;

  return jsonb_build_object('submission_id', v_submission, 'tenant_id', v_form.tenant_id, 'contact_id', v_contact.id, 'lead_id', v_lead);
end;
$$;

-- ---------------------------------------------------------------------------
-- Aplicar enriquecimento (sessão do usuário: o RLS vale)
-- ---------------------------------------------------------------------------

-- p_data: campos já mapeados no servidor {name, trade_name, cnae, city,
-- state, registration_status, size, opened_on, ...}. Preenche só o que está
-- vazio, exceto a situação cadastral (sempre a mais recente), e grava a
-- proveniência de cada campo aplicado.
create function public.company_apply_enrichment(p_tenant uuid, p_company uuid, p_document text, p_status public.enrichment_status, p_data jsonb)
returns public.company_enrichments
language plpgsql security invoker set search_path = ''
as $$
declare
  v_company public.companies;
  v_applied text[] := '{}';
  v_origin jsonb;
  v_provenance jsonb := '{}';
  v_row public.company_enrichments;
begin
  if not private.has_org_role(p_tenant, 'sales') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_company from public.companies where tenant_id = p_tenant and id = p_company and deleted_at is null;
  if v_company.id is null then
    raise exception 'company_not_found' using errcode = 'P0002';
  end if;
  if v_company.document is not null and v_company.document <> p_document then
    raise exception 'document_mismatch' using errcode = '22023';
  end if;

  insert into public.company_enrichments (tenant_id, company_id, source, document, status, data)
  values (p_tenant, p_company, 'brasilapi_cnpj', p_document, p_status, coalesce(p_data, '{}'))
  returning * into v_row;

  if p_status <> 'success' then
    return v_row;
  end if;

  v_origin := jsonb_build_object('source', 'brasilapi_cnpj', 'enrichment_id', v_row.id, 'at', v_row.fetched_at);
  if v_company.document is null then v_applied := array_append(v_applied, 'document'); end if;
  if v_company.trade_name is null and nullif(p_data ->> 'trade_name', '') is not null then v_applied := array_append(v_applied, 'trade_name'); end if;
  if v_company.cnae is null and p_data ->> 'cnae' ~ '^[0-9]{7}$' then v_applied := array_append(v_applied, 'cnae'); end if;
  if v_company.city is null and nullif(p_data ->> 'city', '') is not null then v_applied := array_append(v_applied, 'city'); end if;
  if v_company.state is null and p_data ->> 'state' ~ '^[A-Z]{2}$' then v_applied := array_append(v_applied, 'state'); end if;
  if v_company.size is null and nullif(p_data ->> 'size', '') is not null then v_applied := array_append(v_applied, 'size'); end if;
  if v_company.opened_on is null and p_data ->> 'opened_on' ~ '^\d{4}-\d{2}-\d{2}$' then v_applied := array_append(v_applied, 'opened_on'); end if;
  if nullif(p_data ->> 'registration_status', '') is not null then v_applied := array_append(v_applied, 'registration_status'); end if;

  select coalesce(jsonb_object_agg(field, v_origin), '{}') into v_provenance from unnest(v_applied) field;

  update public.companies set
    document = coalesce(document, p_document),
    trade_name = case when 'trade_name' = any(v_applied) then left(p_data ->> 'trade_name', 200) else trade_name end,
    cnae = case when 'cnae' = any(v_applied) then p_data ->> 'cnae' else cnae end,
    city = case when 'city' = any(v_applied) then left(p_data ->> 'city', 80) else city end,
    state = case when 'state' = any(v_applied) then p_data ->> 'state' else state end,
    size = case when 'size' = any(v_applied) then left(p_data ->> 'size', 60) else size end,
    opened_on = case when 'opened_on' = any(v_applied) then (p_data ->> 'opened_on')::date else opened_on end,
    registration_status = case when 'registration_status' = any(v_applied) then left(p_data ->> 'registration_status', 40) else registration_status end,
    enriched_at = v_row.fetched_at,
    provenance = provenance || v_provenance
  where tenant_id = p_tenant and id = p_company;

  update public.company_enrichments set applied_fields = v_applied where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.capture_forms enable row level security;
alter table public.capture_form_consent_versions enable row level security;
alter table public.form_submissions enable row level security;
alter table public.company_enrichments enable row level security;

revoke all on public.capture_forms, public.capture_form_consent_versions, public.form_submissions, public.company_enrichments from anon, authenticated;
grant select on public.capture_forms, public.capture_form_consent_versions, public.form_submissions, public.company_enrichments to authenticated;
grant insert, update, delete on public.capture_forms to authenticated;
-- Histórico de enriquecimento: inserido pela função (invoker) e marcado com os campos aplicados.
grant insert on public.company_enrichments to authenticated;
grant update (applied_fields) on public.company_enrichments to authenticated;
grant all on public.capture_forms, public.capture_form_consent_versions, public.form_submissions, public.company_enrichments to service_role;

create policy "membros leem formulários" on public.capture_forms for select to authenticated using (private.is_member(tenant_id));
create policy "gestor gerencia formulários" on public.capture_forms for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "membros leem versões do consentimento" on public.capture_form_consent_versions for select to authenticated using (private.is_member(tenant_id));
create policy "membros leem envios" on public.form_submissions for select to authenticated using (private.is_member(tenant_id));

create policy "membros leem enriquecimentos" on public.company_enrichments for select to authenticated using (private.is_member(tenant_id));
create policy "vendedor enriquece" on public.company_enrichments for insert to authenticated with check (private.has_org_role(tenant_id, 'sales'));
create policy "vendedor marca campos aplicados" on public.company_enrichments for update to authenticated
  using (private.has_org_role(tenant_id, 'sales') and fetched_by = (select auth.uid()))
  with check (private.has_org_role(tenant_id, 'sales'));

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

revoke execute on function public.capture_form_submit(text, text, text, text, text, text, text, boolean, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.company_apply_enrichment(uuid, uuid, text, public.enrichment_status, jsonb) from public, anon;
revoke execute on function private.compute_discovery_stage(uuid, uuid, uuid), private.lead_discovery_stage(), private.consent_refresh_discovery(),
  private.capture_form_consent_version(), private.capture_form_record_version(), private.stamp_fetched_by(),
  private.seed_research_source(uuid), private.organization_research_source() from public, anon, authenticated;

grant execute on function public.company_apply_enrichment(uuid, uuid, text, public.enrichment_status, jsonb) to authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
