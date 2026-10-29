-- PeriniHub AI Sales — Fase 7: administração comercial.
--
-- Limites de plano aplicados no banco (não só no app): membros, leads,
-- agentes, números de WhatsApp e formulários por contagem; custo de IA e
-- mensagens pelo consumo mensal (reserve_usage, desde a Fase 1). Planos com
-- preço opcional e marcado como provisório até ser definido; assinatura e
-- cobrança manual alteradas só pelo superadmin, com motivo na auditoria.

-- ---------------------------------------------------------------------------
-- Métricas conhecidas
-- ---------------------------------------------------------------------------

-- kind: count = quantidade existente agora; monthly = consumo do mês (UTC).
create function private.plan_metrics()
returns table (metric text, kind text)
language sql immutable set search_path = ''
as $$
  values ('members', 'count'), ('leads', 'count'), ('agents', 'count'), ('whatsapp_numbers', 'count'),
         ('capture_forms', 'count'), ('ai_cost_usd', 'monthly'), ('whatsapp_messages', 'monthly')
$$;

-- Limites válidos: só métricas conhecidas, números >= 0.
create function private.valid_limits(p_limits jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_limits) = 'object' and not exists (
    select 1 from jsonb_each(p_limits) e
    where e.key not in (select m.metric from private.plan_metrics() m)
       or jsonb_typeof(e.value) <> 'number' or (e.value)::numeric < 0
  )
$$;

-- ---------------------------------------------------------------------------
-- Planos: preço opcional, provisório até ser marcado como definitivo
-- ---------------------------------------------------------------------------

alter table public.subscription_plans
  add column price_monthly_cents bigint check (price_monthly_cents is null or price_monthly_cents >= 0),
  add column currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  add column price_is_final boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add constraint subscription_plans_final_price check (not price_is_final or price_monthly_cents is not null),
  add constraint subscription_plans_limits_check check (private.valid_limits(entitlements -> 'limits'));

-- O plano interno ganha o limite de formulários (métrica nova da Fase 6).
update public.subscription_plans
set entitlements = jsonb_set(entitlements, '{limits,capture_forms}', '20')
where code = 'internal' and not (entitlements -> 'limits' ? 'capture_forms');

alter table public.subscriptions
  add constraint subscriptions_overrides_check check (private.valid_limits(limit_overrides));

create trigger subscription_plans_updated_at before update on public.subscription_plans for each row execute function private.set_updated_at();
create trigger subscription_plans_audit after insert or update on public.subscription_plans for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Limites por contagem, aplicados por trigger
-- ---------------------------------------------------------------------------

create function private.count_metric(p_tenant uuid, p_metric text)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select case p_metric
    when 'members' then (select count(*) from public.organization_members where tenant_id = p_tenant and status = 'active')
    when 'leads' then (select count(*) from public.leads where tenant_id = p_tenant and deleted_at is null)
    when 'agents' then (select count(*) from public.ai_agents where tenant_id = p_tenant)
    when 'whatsapp_numbers' then (select count(*) from public.whatsapp_phone_numbers where tenant_id = p_tenant)
    when 'capture_forms' then (select count(*) from public.capture_forms where tenant_id = p_tenant)
  end
$$;

-- Serializa por empresa e métrica (dois inserts simultâneos não passam juntos
-- do limite). Sem limite configurado ou assinatura inativa = bloqueado.
create function private.assert_count_limit(p_tenant uuid, p_metric text, p_extra bigint default 0)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_limit numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('limit:' || p_tenant::text || ':' || p_metric, 0));
  v_limit := public.effective_limit(p_tenant, p_metric);
  if v_limit is null then
    raise exception 'plan_limit_not_configured: %', p_metric using errcode = '23514';
  end if;
  if private.count_metric(p_tenant, p_metric) + p_extra + 1 > v_limit then
    raise exception 'plan_limit_reached: %', p_metric using errcode = '23514';
  end if;
end;
$$;

create function private.enforce_plan_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_metric text := tg_argv[0];
begin
  if tg_table_name = 'leads' then
    -- Inserção de lead ativo ou restauração de lead excluído.
    if new.deleted_at is not null or (tg_op = 'UPDATE' and old.deleted_at is null) then
      return new;
    end if;
  elsif tg_table_name = 'organization_members' then
    -- Entrada ou reativação; quem já é membro ativo não conta de novo.
    if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then
      return new;
    end if;
    if tg_op = 'INSERT' and exists (
      select 1 from public.organization_members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id and m.status = 'active'
    ) then
      return new;
    end if;
  end if;
  perform private.assert_count_limit(new.tenant_id, v_metric);
  return new;
end;
$$;

create trigger leads_plan_limit before insert or update of deleted_at on public.leads
  for each row execute function private.enforce_plan_limit('leads');
create trigger organization_members_plan_limit before insert or update of status on public.organization_members
  for each row execute function private.enforce_plan_limit('members');
create trigger ai_agents_plan_limit before insert on public.ai_agents
  for each row execute function private.enforce_plan_limit('agents');
create trigger whatsapp_phone_numbers_plan_limit before insert on public.whatsapp_phone_numbers
  for each row execute function private.enforce_plan_limit('whatsapp_numbers');
create trigger capture_forms_plan_limit before insert on public.capture_forms
  for each row execute function private.enforce_plan_limit('capture_forms');

-- Convite também ocupa vaga: membros ativos + convites pendentes válidos.
create function private.enforce_invite_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_count_limit(new.tenant_id, 'members', (
    select count(*) from public.organization_invites i
    where i.tenant_id = new.tenant_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  ));
  return new;
end;
$$;
create trigger organization_invites_plan_limit before insert on public.organization_invites
  for each row execute function private.enforce_invite_limit();

-- ---------------------------------------------------------------------------
-- Consumo × limite (tela do plano, avisos e painel da plataforma)
-- ---------------------------------------------------------------------------

create function public.organization_usage(p_tenant uuid)
returns table (metric text, kind text, used numeric, reserved numeric, limit_value numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_month date := private.current_period_month();
begin
  if not (private.is_service_role() or private.is_member(p_tenant)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select m.metric, m.kind,
    case when m.kind = 'count' then private.count_metric(p_tenant, m.metric)::numeric
         else coalesce((select sum(r.quantity) from public.usage_records r where r.tenant_id = p_tenant and r.metric = m.metric and r.period_month = v_month), 0)
    end,
    case when m.kind = 'count' then 0::numeric
         else coalesce((select sum(u.amount) from public.usage_reservations u
                        where u.tenant_id = p_tenant and u.metric = m.metric and u.period_month = v_month and u.status = 'reserved' and u.expires_at > now()), 0)
    end,
    public.effective_limit(p_tenant, m.metric)
  from private.plan_metrics() m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cobrança manual
-- ---------------------------------------------------------------------------

create type public.invoice_status as enum ('draft', 'issued', 'paid', 'canceled');

create sequence public.billing_invoice_number_seq;

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  number text not null unique default ('PH-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.billing_invoice_number_seq')::text, 5, '0')),
  description text not null check (char_length(description) between 3 and 300),
  period_start date,
  period_end date,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  status public.invoice_status not null default 'draft',
  due_date date not null,
  issued_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  payment_method text check (payment_method is null or char_length(payment_method) between 2 and 60),
  external_ref text check (external_ref is null or char_length(external_ref) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start),
  unique (tenant_id, id)
);
create index billing_invoices_tenant_idx on public.billing_invoices (tenant_id, created_at desc);

create trigger billing_invoices_updated_at before update on public.billing_invoices for each row execute function private.set_updated_at();
create trigger billing_invoices_audit after insert or update on public.billing_invoices for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Funções de plataforma (secret key, depois de conferir o superadmin)
-- ---------------------------------------------------------------------------

create function private.require_reason(p_reason text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
end;
$$;

create function public.platform_upsert_plan(
  p_actor uuid,
  p_code text,
  p_name text,
  p_description text,
  p_limits jsonb,
  p_price_monthly_cents bigint,
  p_price_is_final boolean,
  p_is_public boolean,
  p_active boolean,
  p_reason text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_reason(p_reason);
  perform private.begin_platform_action(p_actor, p_reason);
  if not private.valid_limits(p_limits) then
    raise exception 'invalid_limits' using errcode = '22023';
  end if;
  insert into public.subscription_plans (code, name, description, entitlements, price_monthly_cents, price_is_final, is_public, active)
  values (p_code, btrim(p_name), nullif(btrim(p_description), ''), jsonb_build_object('limits', p_limits), p_price_monthly_cents, p_price_is_final, p_is_public, p_active)
  on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    entitlements = jsonb_set(public.subscription_plans.entitlements, '{limits}', p_limits),
    price_monthly_cents = excluded.price_monthly_cents,
    price_is_final = excluded.price_is_final,
    is_public = excluded.is_public,
    active = excluded.active;
end;
$$;

create function public.platform_update_subscription(
  p_actor uuid,
  p_tenant uuid,
  p_plan_code text,
  p_status public.subscription_status,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit_overrides jsonb,
  p_notes text,
  p_reason text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_reason(p_reason);
  perform private.begin_platform_action(p_actor, p_reason);
  if not exists (select 1 from public.subscription_plans where code = p_plan_code and active) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if not private.valid_limits(coalesce(p_limit_overrides, '{}')) then
    raise exception 'invalid_limits' using errcode = '22023';
  end if;
  update public.subscriptions set
    plan_code = p_plan_code,
    status = p_status,
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    limit_overrides = coalesce(p_limit_overrides, '{}'),
    notes = nullif(btrim(p_notes), '')
  where tenant_id = p_tenant;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.platform_create_invoice(
  p_actor uuid,
  p_tenant uuid,
  p_description text,
  p_amount_cents bigint,
  p_due_date date,
  p_period_start date,
  p_period_end date,
  p_notes text,
  p_reason text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_reason(p_reason);
  perform private.begin_platform_action(p_actor, p_reason);
  if not exists (select 1 from public.organizations where id = p_tenant) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  insert into public.billing_invoices (tenant_id, description, amount_cents, due_date, period_start, period_end, notes, created_by)
  values (p_tenant, btrim(p_description), p_amount_cents, p_due_date, p_period_start, p_period_end, nullif(btrim(p_notes), ''), p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- Rascunho → emitida → paga; rascunho ou emitida → cancelada. Paga e
-- cancelada são finais (correção = nova cobrança).
create function public.platform_set_invoice_status(
  p_actor uuid,
  p_invoice uuid,
  p_status public.invoice_status,
  p_payment_method text,
  p_external_ref text,
  p_reason text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_invoice public.billing_invoices;
begin
  perform private.require_reason(p_reason);
  perform private.begin_platform_action(p_actor, p_reason);
  select * into v_invoice from public.billing_invoices where id = p_invoice for update;
  if v_invoice.id is null then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if not (
    (v_invoice.status = 'draft' and p_status in ('issued', 'canceled'))
    or (v_invoice.status = 'issued' and p_status in ('paid', 'canceled'))
  ) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if p_status = 'paid' and nullif(btrim(p_payment_method), '') is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  update public.billing_invoices set
    status = p_status,
    issued_at = case when p_status = 'issued' then now() else issued_at end,
    paid_at = case when p_status = 'paid' then now() else paid_at end,
    canceled_at = case when p_status = 'canceled' then now() else canceled_at end,
    payment_method = case when p_status = 'paid' then btrim(p_payment_method) else payment_method end,
    external_ref = coalesce(nullif(btrim(p_external_ref), ''), external_ref)
  where id = p_invoice;
end;
$$;

-- Saúde das integrações por empresa (sem conteúdo de mensagens).
create function public.platform_integration_health()
returns table (
  tenant_id uuid,
  whatsapp_accounts bigint,
  whatsapp_with_error bigint,
  last_whatsapp_error text,
  webhook_failed_7d bigint,
  webhook_dead_letter_7d bigint,
  webhook_pending_stale bigint,
  last_webhook_at timestamptz,
  agent_failed_24h bigint,
  agent_runs_24h bigint,
  campaigns_running bigint
)
language sql stable security definer set search_path = ''
as $$
  select o.id,
    (select count(*) from public.whatsapp_accounts a where a.tenant_id = o.id),
    (select count(*) from public.whatsapp_accounts a where a.tenant_id = o.id and a.status in ('error', 'disconnected')),
    (select a.last_error from public.whatsapp_accounts a where a.tenant_id = o.id and a.last_error is not null order by a.updated_at desc nulls last limit 1),
    (select count(*) from public.webhook_events w where w.tenant_id = o.id and w.status = 'failed' and w.received_at > now() - interval '7 days'),
    (select count(*) from public.webhook_events w where w.tenant_id = o.id and w.status = 'dead_letter' and w.received_at > now() - interval '7 days'),
    (select count(*) from public.webhook_events w where w.tenant_id = o.id and w.status = 'pending' and w.received_at < now() - interval '15 minutes'),
    (select max(w.received_at) from public.webhook_events w where w.tenant_id = o.id),
    (select count(*) from public.agent_executions e where e.tenant_id = o.id and e.status = 'failed' and e.started_at > now() - interval '24 hours'),
    (select count(*) from public.agent_executions e where e.tenant_id = o.id and e.started_at > now() - interval '24 hours'),
    (select count(*) from public.campaigns c where c.tenant_id = o.id and c.status = 'running')
  from public.organizations o
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.billing_invoices enable row level security;
revoke all on public.billing_invoices from anon, authenticated;
grant select on public.billing_invoices to authenticated;
grant all on public.billing_invoices to service_role;
grant usage on sequence public.billing_invoice_number_seq to service_role;

-- Admin e proprietário veem as cobranças da empresa (rascunho não aparece).
create policy "admin vê cobranças emitidas" on public.billing_invoices for select to authenticated
  using (private.has_org_role(tenant_id, 'admin') and status <> 'draft');

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

revoke execute on function
  public.platform_upsert_plan(uuid, text, text, text, jsonb, bigint, boolean, boolean, boolean, text),
  public.platform_update_subscription(uuid, uuid, text, public.subscription_status, timestamptz, timestamptz, jsonb, text, text),
  public.platform_create_invoice(uuid, uuid, text, bigint, date, date, date, text, text),
  public.platform_set_invoice_status(uuid, uuid, public.invoice_status, text, text, text),
  public.platform_integration_health()
  from public, anon, authenticated;
revoke execute on function public.organization_usage(uuid) from public, anon;
grant execute on function public.organization_usage(uuid) to authenticated;
-- valid_limits roda nos checks das tabelas (inclusive em inserts do usuário).
grant execute on function private.valid_limits(jsonb), private.plan_metrics() to authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
