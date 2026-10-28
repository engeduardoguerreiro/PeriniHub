-- PeriniHub AI Sales — Fase 5: campanhas e follow-up automático.
--
-- Regras centrais (briefing §14 e cenários críticos 4, 5 e 8):
-- * campanha só sai com aprovação explícita de gestor ou acima;
-- * o público é filtrado por consentimento, supressão e finalidade, e cada
--   contato excluído tem o motivo registrado;
-- * o agendamento não substitui o gate: cada envio passa por
--   whatsapp_send_gate na hora (consentimento, supressão, frequência);
-- * pausa (inclusive de emergência) interrompe novos envios na hora;
-- * envio em lotes com limites por hora, dia e total — nunca tudo de uma vez;
-- * campanhas e follow-up só por número oficial (Evolution bloqueia no gate).

create type public.campaign_status as enum ('draft', 'awaiting_approval', 'scheduled', 'running', 'paused', 'completed', 'canceled');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  objective text check (objective is null or char_length(objective) <= 1000),
  purpose public.consent_purpose not null default 'marketing',
  phone_number_id uuid not null,
  template_id uuid not null,
  -- Valores das variáveis do template; "{{nome}}" vira o primeiro nome do contato.
  template_parameters jsonb not null default '[]' check (jsonb_typeof(template_parameters) = 'array'),
  -- {"stage_ids": [], "source_ids": [], "tag_ids": [], "qualifications": []}
  audience_filter jsonb not null default '{}' check (jsonb_typeof(audience_filter) = 'object'),
  status public.campaign_status not null default 'draft',
  starts_at timestamptz,
  window_start time not null default '09:00',
  window_end time not null default '18:00',
  hourly_limit integer not null default 20 check (hourly_limit between 1 and 1000),
  daily_limit integer not null default 100 check (daily_limit between 1 and 10000),
  total_limit integer not null default 500 check (total_limit between 1 and 100000),
  audience_built_at timestamptz,
  eligible_count integer not null default 0,
  excluded_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  emergency_stopped_at timestamptz,
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_start < window_end),
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id),
  foreign key (tenant_id, template_id) references public.whatsapp_templates (tenant_id, id),
  unique (tenant_id, id)
);
create index campaigns_running_idx on public.campaigns (status) where status in ('scheduled', 'running');

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  contact_id uuid not null,
  eligibility text not null check (eligibility in ('eligible', 'excluded')),
  exclusion_reason text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'blocked', 'failed', 'skipped')),
  send_request_id uuid,
  detail text check (detail is null or char_length(detail) <= 500),
  processed_at timestamptz,
  foreign key (tenant_id, campaign_id) references public.campaigns (tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, send_request_id) references public.message_send_requests (tenant_id, id) on delete set null (send_request_id),
  unique (campaign_id, contact_id)
);
create index campaign_recipients_queue_idx on public.campaign_recipients (campaign_id, status) where eligibility = 'eligible';

create table public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  planned integer not null default 0,
  sent integer not null default 0,
  blocked integer not null default 0,
  failed integer not null default 0,
  stopped_reason text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (tenant_id, campaign_id) references public.campaigns (tenant_id, id) on delete cascade
);

create table public.followup_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  active boolean not null default false,
  idle_days integer not null default 7 check (idle_days between 1 and 180),
  stage_ids uuid[] not null default '{}',
  phone_number_id uuid not null,
  template_id uuid not null,
  template_parameters jsonb not null default '[]' check (jsonb_typeof(template_parameters) = 'array'),
  purpose public.consent_purpose not null default 'sales_followup',
  max_attempts integer not null default 2 check (max_attempts between 1 and 5),
  min_interval_days integer not null default 3 check (min_interval_days between 1 and 60),
  max_per_run integer not null default 20 check (max_per_run between 1 and 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id),
  foreign key (tenant_id, template_id) references public.whatsapp_templates (tenant_id, id),
  unique (tenant_id, id)
);

create table public.followup_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  rule_id uuid not null,
  lead_id uuid not null,
  attempt integer not null,
  status text not null check (status in ('sent', 'blocked', 'failed')),
  send_request_id uuid,
  detail text check (detail is null or char_length(detail) <= 500),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, rule_id) references public.followup_rules (tenant_id, id) on delete cascade,
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade,
  -- Mesma tentativa nunca sai duas vezes (jobs repetidos).
  unique (rule_id, lead_id, attempt)
);

create trigger campaigns_updated_at before update on public.campaigns for each row execute function private.set_updated_at();
create trigger followup_rules_updated_at before update on public.followup_rules for each row execute function private.set_updated_at();
create trigger campaigns_audit after insert or update or delete on public.campaigns for each row execute function private.audit_change();
create trigger followup_rules_audit after insert or update or delete on public.followup_rules for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Público da campanha
-- ---------------------------------------------------------------------------

-- Monta (ou refaz) o público: contatos que casam com o filtro viram
-- elegíveis ou excluídos com o motivo. Só em rascunho.
create function public.campaign_build_audience(p_tenant uuid, p_campaign uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_filter jsonb;
  v_eligible integer;
  v_excluded integer;
begin
  if not (private.has_org_role(p_tenant, 'manager') or private.is_service_role()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_campaign from public.campaigns where id = p_campaign and tenant_id = p_tenant for update;
  if v_campaign.id is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_campaign.status <> 'draft' then
    raise exception 'campaign_not_draft' using errcode = '22023';
  end if;
  v_filter := v_campaign.audience_filter;

  delete from public.campaign_recipients where campaign_id = p_campaign;

  insert into public.campaign_recipients (tenant_id, campaign_id, contact_id, eligibility, exclusion_reason)
  select p_tenant, p_campaign, c.id,
    case when reason is null then 'eligible' else 'excluded' end,
    reason
  from (
    select c.id,
      case
        when c.phone_e164 is null then 'sem telefone'
        when exists (select 1 from public.suppression_list s where s.tenant_id = p_tenant and s.channel = 'whatsapp' and s.identifier = c.phone_e164) then 'descadastrado'
        when not exists (
          select 1 from public.current_consents cc
          where cc.tenant_id = p_tenant and cc.contact_id = c.id and cc.channel = 'whatsapp' and cc.is_valid and cc.purpose = v_campaign.purpose
        ) then 'sem consentimento para a finalidade'
        else null
      end as reason
    from public.contacts c
    where c.tenant_id = p_tenant and c.deleted_at is null
      and (coalesce(jsonb_array_length(v_filter -> 'tag_ids'), 0) = 0 or exists (
        select 1 from public.contact_tags ct where ct.contact_id = c.id and ct.tag_id::text in (select jsonb_array_elements_text(v_filter -> 'tag_ids'))))
      and (coalesce(jsonb_array_length(v_filter -> 'stage_ids'), 0) = 0
           and coalesce(jsonb_array_length(v_filter -> 'source_ids'), 0) = 0
           and coalesce(jsonb_array_length(v_filter -> 'qualifications'), 0) = 0
        or exists (
          select 1 from public.leads l
          where l.contact_id = c.id and l.deleted_at is null
            and (coalesce(jsonb_array_length(v_filter -> 'stage_ids'), 0) = 0 or l.stage_id::text in (select jsonb_array_elements_text(v_filter -> 'stage_ids')))
            and (coalesce(jsonb_array_length(v_filter -> 'source_ids'), 0) = 0 or l.lead_source_id::text in (select jsonb_array_elements_text(v_filter -> 'source_ids')))
            and (coalesce(jsonb_array_length(v_filter -> 'qualifications'), 0) = 0 or l.qualification::text in (select jsonb_array_elements_text(v_filter -> 'qualifications')))))
    limit 100000
  ) c;

  select count(*) filter (where eligibility = 'eligible'), count(*) filter (where eligibility = 'excluded')
  into v_eligible, v_excluded from public.campaign_recipients where campaign_id = p_campaign;
  update public.campaigns set audience_built_at = now(), eligible_count = v_eligible, excluded_count = v_excluded where id = p_campaign;
  return jsonb_build_object('eligible', v_eligible, 'excluded', v_excluded);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ciclo de vida
-- ---------------------------------------------------------------------------

-- Transições permitidas, papel exigido, aprovação por outra pessoa quando a
-- empresa tem mais de um gestor (D-08) e motivo obrigatório para parar.
create function public.campaign_transition(p_tenant uuid, p_campaign uuid, p_to public.campaign_status, p_reason text default null, p_emergency boolean default false)
returns public.campaigns
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_actor uuid := (select auth.uid());
  v_managers integer;
  v_allowed boolean;
begin
  if not (private.has_org_role(p_tenant, 'manager') or private.is_service_role()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_campaign from public.campaigns where id = p_campaign and tenant_id = p_tenant for update;
  if v_campaign.id is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  v_allowed := case v_campaign.status
    when 'draft' then p_to in ('awaiting_approval', 'canceled')
    when 'awaiting_approval' then p_to in ('scheduled', 'draft', 'canceled')
    when 'scheduled' then p_to in ('running', 'paused', 'canceled')
    when 'running' then p_to in ('paused', 'completed', 'canceled')
    when 'paused' then p_to in ('running', 'canceled')
    else false
  end;
  -- Retomar depois de pausa de emergência exige nova aprovação.
  if v_campaign.status = 'paused' and p_to = 'running' and v_campaign.emergency_stopped_at is not null then
    v_allowed := false;
  end if;
  if not v_allowed then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if p_to = 'awaiting_approval' and (v_campaign.audience_built_at is null or v_campaign.eligible_count = 0) then
    raise exception 'audience_required' using errcode = '22023';
  end if;

  if p_to = 'scheduled' then
    -- Aprovação: por gestor ou acima e, havendo outro gestor, não por quem criou.
    select count(*) into v_managers from public.organization_members
    where tenant_id = p_tenant and status = 'active' and role in ('manager', 'admin', 'owner');
    if v_actor is not null and v_actor = v_campaign.created_by and v_managers > 1 then
      raise exception 'approval_by_other' using errcode = '42501';
    end if;
  end if;

  if p_to in ('paused', 'canceled') and (p_reason is null or char_length(btrim(p_reason)) < 3) then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  update public.campaigns set
    status = p_to,
    approved_by = case when p_to = 'scheduled' then v_actor else approved_by end,
    approved_at = case when p_to = 'scheduled' then now() else approved_at end,
    emergency_stopped_at = case when p_emergency then now() else emergency_stopped_at end,
    status_reason = case when p_reason is not null then left(btrim(p_reason), 500) else status_reason end
  where id = p_campaign
  returning * into v_campaign;

  -- Parar libera quem estava na fila do lote atual.
  if p_to in ('paused', 'canceled') then
    update public.campaign_recipients set status = 'pending' where campaign_id = p_campaign and status = 'processing';
  end if;
  if p_to = 'canceled' then
    update public.campaign_recipients set status = 'skipped', detail = 'campanha cancelada', processed_at = now()
    where campaign_id = p_campaign and status = 'pending' and eligibility = 'eligible';
  end if;
  return v_campaign;
end;
$$;

-- Reserva o próximo lote de destinatários (sem duplicar entre execuções
-- concorrentes). Só o servidor/worker.
create function public.campaign_claim_recipients(p_campaign uuid, p_limit integer)
returns setof public.campaign_recipients
language sql security definer set search_path = ''
as $$
  update public.campaign_recipients set status = 'processing'
  where id in (
    select id from public.campaign_recipients
    where campaign_id = p_campaign and eligibility = 'eligible' and status = 'pending'
    order by id
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning *
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.campaign_runs enable row level security;
alter table public.followup_rules enable row level security;
alter table public.followup_executions enable row level security;

revoke all on public.campaigns, public.campaign_recipients, public.campaign_runs, public.followup_rules, public.followup_executions from anon, authenticated;
grant all on public.campaigns, public.campaign_recipients, public.campaign_runs, public.followup_rules, public.followup_executions to service_role;
grant select on public.campaigns, public.campaign_recipients, public.campaign_runs, public.followup_rules, public.followup_executions to authenticated;
-- Status só muda por campaign_transition; o resto do rascunho é editável.
grant insert (tenant_id, name, objective, purpose, phone_number_id, template_id, template_parameters, audience_filter, starts_at,
              window_start, window_end, hourly_limit, daily_limit, total_limit, created_by) on public.campaigns to authenticated;
grant update (name, objective, purpose, phone_number_id, template_id, template_parameters, audience_filter, starts_at,
              window_start, window_end, hourly_limit, daily_limit, total_limit) on public.campaigns to authenticated;
grant insert, update, delete on public.followup_rules to authenticated;

create policy "gestor vê campanhas" on public.campaigns for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor cria campanhas" on public.campaigns for insert to authenticated with check (private.has_org_role(tenant_id, 'manager'));
create policy "gestor edita rascunhos" on public.campaigns for update to authenticated
  using (private.has_org_role(tenant_id, 'manager') and status = 'draft') with check (private.has_org_role(tenant_id, 'manager') and status = 'draft');
create policy "gestor vê destinatários" on public.campaign_recipients for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor vê lotes" on public.campaign_runs for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor vê regras" on public.followup_rules for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor mantém regras" on public.followup_rules for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "gestor vê execuções de follow-up" on public.followup_executions for select to authenticated using (private.has_org_role(tenant_id, 'manager'));

revoke execute on function public.campaign_build_audience(uuid, uuid), public.campaign_transition(uuid, uuid, public.campaign_status, text, boolean),
  public.campaign_claim_recipients(uuid, integer) from public, anon;
revoke execute on function public.campaign_claim_recipients(uuid, integer) from authenticated;
grant execute on function public.campaign_build_audience(uuid, uuid), public.campaign_transition(uuid, uuid, public.campaign_status, text, boolean) to authenticated, service_role;
grant execute on function public.campaign_claim_recipients(uuid, integer) to service_role;
