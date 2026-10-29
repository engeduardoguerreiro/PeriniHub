-- PeriniHub AI Sales — Fase 1: plataforma multiempresa.
-- Empresas, membros, convites, configurações, superadmins, planos,
-- assinaturas, consumo, auditoria e limite de tentativas.
--
-- Regras gerais (docs/ai-sales/DATABASE.md):
-- * toda tabela de empresa tem tenant_id e RLS;
-- * escrita direta só onde uma policy permite; o resto passa por funções;
-- * funções security definer com search_path vazio e nomes qualificados;
-- * helpers de autorização no schema private (fora da Data API).

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

-- A ordem importa: comparações (>=) seguem a hierarquia viewer < ... < owner.
create type public.org_role as enum ('viewer', 'sales', 'manager', 'admin', 'owner');
create type public.org_status as enum ('active', 'suspended', 'closed');
create type public.member_status as enum ('active', 'disabled');
create type public.actor_type as enum ('user', 'agent', 'system', 'platform_admin');
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'internal');
create type public.billing_mode as enum ('manual', 'gateway');
create type public.sales_visibility as enum ('all', 'assigned');
create type public.reservation_status as enum ('reserved', 'settled', 'released');

create schema private;
revoke all on schema private from public;
-- As policies rodam com o papel de quem consulta: authenticated precisa
-- enxergar o schema para chamar os helpers (que não ficam expostos na API).
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 120),
  legal_name text check (legal_name is null or char_length(legal_name) between 2 and 200),
  document text check (document is null or document ~ '^[0-9]{14}$'),
  status public.org_status not null default 'active',
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index organizations_document_key on public.organizations (document) where document is not null;

-- Dados de exibição dos usuários (auth.users não é legível pela API).
create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id) where status = 'active';

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(btrim(email_normalized)) and email_normalized like '%_@_%'),
  role public.org_role not null,
  -- Só o SHA-256 do token; o token em si aparece uma única vez para quem convidou.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
-- Um convite pendente por e-mail e empresa.
create unique index organization_invites_pending_key on public.organization_invites (tenant_id, email_normalized)
  where accepted_at is null and revoked_at is null;

create table public.organization_settings (
  tenant_id uuid primary key references public.organizations (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 3 and 64),
  locale text not null default 'pt-BR' check (locale in ('pt-BR')),
  sales_visibility public.sales_visibility not null default 'all',
  require_mfa boolean not null default false,
  viewer_can_read_conversations boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  note text,
  granted_at timestamptz not null default now()
);

create table public.subscription_plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  -- {"limits": {"members": 10, "ai_cost_usd": 0, ...}}; métrica ausente = bloqueada.
  entitlements jsonb not null default '{"limits": {}}' check (jsonb_typeof(entitlements -> 'limits') = 'object'),
  is_public boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code),
  status public.subscription_status not null default 'internal',
  billing_mode public.billing_mode not null default 'manual',
  current_period_start timestamptz,
  current_period_end timestamptz,
  limit_overrides jsonb not null default '{}' check (jsonb_typeof(limit_overrides) = 'object'),
  external_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  metric text not null check (metric ~ '^[a-z_]{2,40}$'),
  quantity numeric(18, 6) not null check (quantity >= 0),
  period_month date not null,
  source_type text,
  source_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);
create index usage_records_period_idx on public.usage_records (tenant_id, metric, period_month);

create table public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  metric text not null check (metric ~ '^[a-z_]{2,40}$'),
  amount numeric(18, 6) not null check (amount > 0),
  actual_amount numeric(18, 6) check (actual_amount is null or actual_amount >= 0),
  period_month date not null,
  status public.reservation_status not null default 'reserved',
  idempotency_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);
create index usage_reservations_open_idx on public.usage_reservations (tenant_id, metric, period_month) where status = 'reserved';

-- Sem FK para organizations: o histórico sobrevive à exclusão da empresa.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  actor_type public.actor_type not null,
  actor_id uuid,
  action text not null check (char_length(action) between 2 and 120),
  entity_type text not null,
  entity_id text,
  diff jsonb,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_platform_idx on public.audit_logs (created_at desc) where actor_type = 'platform_admin';

create table public.rate_limits (
  bucket_key text not null check (char_length(bucket_key) between 3 and 200),
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (bucket_key, window_start)
);

-- ---------------------------------------------------------------------------
-- Helpers de autorização
-- ---------------------------------------------------------------------------

-- Papel do usuário logado numa empresa ativa (null se não é membro ativo).
-- security definer: as policies consultam membros sem depender do RLS deles.
create function private.org_role(p_tenant uuid)
returns public.org_role
language sql stable security definer set search_path = ''
as $$
  select m.role
  from public.organization_members m
  join public.organizations o on o.id = m.tenant_id
  where m.tenant_id = p_tenant
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and o.status = 'active'
$$;

create function private.is_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.org_role(p_tenant) is not null
$$;

create function private.has_org_role(p_tenant uuid, p_min public.org_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.org_role(p_tenant) >= p_min, false)
$$;

-- Vínculo ativo, com a empresa em qualquer status: permite listar empresas
-- suspensas no seletor sem dar acesso aos dados delas.
create function private.is_listed_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid()) and m.status = 'active'
  )
$$;

-- Usuários que dividem ao menos uma empresa ativa com o usuário logado.
create function private.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members other on other.tenant_id = mine.tenant_id
    join public.organizations o on o.id = mine.tenant_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and other.user_id = p_user and o.status = 'active'
  )
$$;

create function private.is_platform_admin(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = p_user)
$$;

create function private.is_service_role()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role') = 'service_role', false)
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function private.set_updated_at();
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger organization_settings_updated_at before update on public.organization_settings
  for each row execute function private.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- Auditoria genérica. O autor vem da sessão (auth.uid()) ou, nas funções de
-- plataforma chamadas pelo servidor com a secret key, de app.actor_id.
create function private.audit_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'token_hash' end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'token_hash' end;
  v_row jsonb := coalesce(v_new, v_old);
  v_setting text := nullif(current_setting('app.actor_id', true), '');
  v_actor uuid := coalesce(v_setting::uuid, (select auth.uid()));
  v_actor_type public.actor_type;
  v_diff jsonb;
  v_key text;
begin
  v_actor_type := case
    when current_setting('app.actor_type', true) = 'platform_admin' then 'platform_admin'
    when v_actor is not null then 'user'
    else 'system'
  end;

  if tg_op = 'UPDATE' then
    v_diff := jsonb_build_object('old', '{}'::jsonb, 'new', '{}'::jsonb);
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_diff := jsonb_set(v_diff, array['old', v_key], coalesce(v_old -> v_key, 'null'::jsonb));
        v_diff := jsonb_set(v_diff, array['new', v_key], coalesce(v_new -> v_key, 'null'::jsonb));
      end if;
    end loop;
    if v_diff -> 'new' = '{}'::jsonb then
      return new;
    end if;
  else
    v_diff := v_row;
  end if;

  insert into public.audit_logs (tenant_id, actor_type, actor_id, action, entity_type, entity_id, diff, reason)
  values (
    coalesce((v_row ->> 'tenant_id')::uuid, case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end),
    v_actor_type,
    v_actor,
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'tenant_id'),
    v_diff,
    nullif(current_setting('app.reason', true), '')
  );
  return coalesce(new, old);
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.audit_change();
create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_change();
create trigger organization_invites_audit after insert or update on public.organization_invites
  for each row execute function private.audit_change();
create trigger organization_settings_audit after update on public.organization_settings
  for each row execute function private.audit_change();
create trigger subscriptions_audit after insert or update on public.subscriptions
  for each row execute function private.audit_change();
create trigger platform_admins_audit after insert or delete on public.platform_admins
  for each row execute function private.audit_change();

-- Guarda de membros: ninguém abaixo de OWNER mexe em OWNER ou promove a
-- OWNER, e a empresa nunca fica sem um OWNER ativo. A secret key (servidor)
-- passa pela primeira regra, mas não pela segunda.
create function private.guard_members()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_role public.org_role;
begin
  -- app.trusted_op: aceite de convite (a função já validou o convite).
  if not private.is_service_role() and (select auth.uid()) is not null
     and coalesce(current_setting('app.trusted_op', true), '') <> 'on' then
    v_actor_role := private.org_role(old.tenant_id);
    if v_actor_role is distinct from 'owner' then
      if old.role = 'owner' and old.user_id <> (select auth.uid()) then
        raise exception 'owner_protected' using errcode = '42501';
      end if;
      if tg_op = 'UPDATE' and new.role = 'owner' then
        raise exception 'owner_protected' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'immutable_member_keys' using errcode = '42501';
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     -- Exclusão da empresa inteira (cascade): a guarda não se aplica.
     and exists (select 1 from public.organizations where id = old.tenant_id)
     and not exists (
       select 1 from public.organization_members
       where tenant_id = old.tenant_id and user_id <> old.user_id and role = 'owner' and status = 'active'
     ) then
    raise exception 'last_owner' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_guard before update or delete on public.organization_members
  for each row execute function private.guard_members();

-- ---------------------------------------------------------------------------
-- Funções de membros e convites (chamadas com a sessão do usuário)
-- ---------------------------------------------------------------------------

-- Cria convite. O token é gerado no servidor do app; aqui chega só o hash.
create function public.create_invite(p_tenant uuid, p_email text, p_role public.org_role, p_token_hash text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.org_role := private.org_role(p_tenant);
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if v_role is null or v_role < 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_role = 'owner' and v_role <> 'owner' then
    raise exception 'owner_protected' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.organization_members m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = p_tenant and p.email = v_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  insert into public.organization_invites (tenant_id, email_normalized, role, token_hash, invited_by)
  values (p_tenant, v_email, p_role, p_token_hash, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Dados do convite para a página pública /ai-sales/convite/[token].
-- Quem tem o token recebeu o link no e-mail convidado.
create function public.get_invite_preview(p_token_hash text)
returns table (organization_name text, organization_slug text, email text, role public.org_role, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select o.name, o.slug, i.email_normalized, i.role, i.expires_at
  from public.organization_invites i
  join public.organizations o on o.id = i.tenant_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and o.status = 'active'
$$;

-- Aceita o convite com a conta logada; o e-mail da conta precisa ser o convidado.
create function public.accept_invite(p_token_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower((select auth.jwt() ->> 'email'));
  v_invite public.organization_invites;
  v_slug text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.organization_invites where token_hash = p_token_hash for update;
  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_used' using errcode = 'P0002';
  end if;
  if v_invite.email_normalized is distinct from v_email then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;

  select slug into v_slug from public.organizations where id = v_invite.tenant_id and status = 'active';
  if v_slug is null then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  insert into public.user_profiles (user_id, email) values (v_user, v_email)
  on conflict (user_id) do update set email = excluded.email;

  perform set_config('app.trusted_op', 'on', true);
  insert into public.organization_members (tenant_id, user_id, role, invited_by)
  values (v_invite.tenant_id, v_user, v_invite.role, v_invite.invited_by)
  on conflict (tenant_id, user_id) do update set status = 'active', role = excluded.role;

  update public.organization_invites set accepted_at = now(), accepted_by = v_user where id = v_invite.id;
  perform set_config('app.trusted_op', '', true);
  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções de plataforma (só a secret key, chamadas pelo servidor após
-- conferir o superadmin). Registram autor e motivo na auditoria.
-- ---------------------------------------------------------------------------

create function private.begin_platform_action(p_actor uuid, p_reason text)
returns void
language plpgsql set search_path = ''
as $$
begin
  if not private.is_platform_admin(p_actor) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  perform set_config('app.actor_id', p_actor::text, true);
  perform set_config('app.actor_type', 'platform_admin', true);
  perform set_config('app.reason', coalesce(p_reason, ''), true);
end;
$$;

create function public.platform_create_organization(
  p_actor uuid,
  p_name text,
  p_slug text,
  p_owner_email text,
  p_owner_token_hash text,
  p_legal_name text default null,
  p_document text default null,
  p_plan_code text default 'internal',
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.begin_platform_action(p_actor, p_reason);

  insert into public.organizations (slug, name, legal_name, document, created_by)
  values (p_slug, btrim(p_name), nullif(btrim(p_legal_name), ''), nullif(p_document, ''), p_actor)
  returning id into v_id;

  insert into public.organization_settings (tenant_id) values (v_id);
  insert into public.subscriptions (tenant_id, plan_code, status, billing_mode)
  values (v_id, p_plan_code, 'internal', 'manual');
  insert into public.organization_invites (tenant_id, email_normalized, role, token_hash, invited_by)
  values (v_id, lower(btrim(p_owner_email)), 'owner', p_owner_token_hash, p_actor);

  return v_id;
end;
$$;

create function public.platform_set_organization_status(p_actor uuid, p_tenant uuid, p_status public.org_status, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  perform private.begin_platform_action(p_actor, p_reason);
  update public.organizations set status = p_status, status_reason = btrim(p_reason) where id = p_tenant;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Novo convite de OWNER (ex.: o primeiro expirou).
create function public.platform_invite_owner(p_actor uuid, p_tenant uuid, p_email text, p_token_hash text, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.begin_platform_action(p_actor, p_reason);
  update public.organization_invites set revoked_at = now()
  where tenant_id = p_tenant and email_normalized = lower(btrim(p_email)) and accepted_at is null and revoked_at is null;
  insert into public.organization_invites (tenant_id, email_normalized, role, token_hash, invited_by)
  values (p_tenant, lower(btrim(p_email)), 'owner', p_token_hash, p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consumo e limites
-- ---------------------------------------------------------------------------

create function private.current_period_month()
returns date
language sql stable set search_path = ''
as $$
  select (date_trunc('month', now() at time zone 'utc'))::date
$$;

-- Limite efetivo: override da assinatura > plano. null = métrica não liberada.
create function public.effective_limit(p_tenant uuid, p_metric text)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (s.limit_overrides ->> p_metric)::numeric,
    (p.entitlements -> 'limits' ->> p_metric)::numeric
  )
  from public.subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.tenant_id = p_tenant and s.status in ('trial', 'active', 'internal')
$$;

-- Reserva consumo antes de gastar (IA, mensagens). Serializa por empresa e
-- métrica; a mesma chave devolve a mesma reserva (retry não cobra de novo).
create function public.reserve_usage(p_tenant uuid, p_metric text, p_amount numeric, p_key text, p_ttl_seconds integer default 3600)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_month date := private.current_period_month();
  v_existing uuid;
  v_limit numeric;
  v_used numeric;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text || ':' || p_metric || ':' || v_month::text, 0));

  select id into v_existing from public.usage_reservations where tenant_id = p_tenant and idempotency_key = p_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (select 1 from public.organizations where id = p_tenant and status = 'active') then
    raise exception 'organization_inactive' using errcode = '42501';
  end if;

  v_limit := public.effective_limit(p_tenant, p_metric);
  if v_limit is null then
    raise exception 'limit_not_configured' using errcode = '22023';
  end if;

  select coalesce(sum(quantity), 0) into v_used
  from public.usage_records where tenant_id = p_tenant and metric = p_metric and period_month = v_month;
  select v_used + coalesce(sum(amount), 0) into v_used
  from public.usage_reservations
  where tenant_id = p_tenant and metric = p_metric and period_month = v_month and status = 'reserved' and expires_at > now();

  if v_used + p_amount > v_limit then
    raise exception 'usage_limit_exceeded' using errcode = '23514';
  end if;

  insert into public.usage_reservations (tenant_id, metric, amount, period_month, idempotency_key, expires_at)
  values (p_tenant, p_metric, p_amount, v_month, p_key, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;
  return v_id;
end;
$$;

-- Fecha a reserva com o valor real (pode ser menor ou zero).
create function public.settle_usage(p_tenant uuid, p_reservation uuid, p_actual numeric, p_source_type text default null, p_source_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_res public.usage_reservations;
begin
  select * into v_res from public.usage_reservations where id = p_reservation and tenant_id = p_tenant for update;
  if v_res.id is null then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_res.status <> 'reserved' then
    return;
  end if;
  update public.usage_reservations set status = 'settled', actual_amount = p_actual, finished_at = now() where id = v_res.id;
  insert into public.usage_records (tenant_id, metric, quantity, period_month, source_type, source_id, idempotency_key)
  values (p_tenant, v_res.metric, p_actual, v_res.period_month, p_source_type, p_source_id, 'reservation:' || v_res.id)
  on conflict (tenant_id, idempotency_key) do nothing;
end;
$$;

create function public.release_usage(p_tenant uuid, p_reservation uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.usage_reservations set status = 'released', finished_at = now()
  where id = p_reservation and tenant_id = p_tenant and status = 'reserved'
$$;

-- ---------------------------------------------------------------------------
-- Limite de tentativas (login, convites, formulários)
-- ---------------------------------------------------------------------------

create function public.consume_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (bucket_key, window_start) values (p_key, v_window)
  on conflict (bucket_key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Limpeza ocasional de janelas antigas, sem job dedicado.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.organization_settings enable row level security;
alter table public.platform_admins enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.usage_reservations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Grants explícitos: começa sem nada para anon/authenticated.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations, public.user_profiles, public.organization_members,
  public.organization_settings, public.subscription_plans, public.subscriptions,
  public.usage_records, public.usage_reservations, public.audit_logs to authenticated;
-- token_hash fica de fora: nem quem administra a empresa lê o hash.
grant select (id, tenant_id, email_normalized, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  on public.organization_invites to authenticated;
grant update (name, legal_name) on public.organizations to authenticated;
grant update (full_name) on public.user_profiles to authenticated;
grant update (role, status) on public.organization_members to authenticated;
grant delete on public.organization_members to authenticated;
grant update (revoked_at) on public.organization_invites to authenticated;
grant update (timezone, sales_visibility, require_mfa, viewer_can_read_conversations, updated_by)
  on public.organization_settings to authenticated;
grant all on all tables in schema public to service_role;

create policy "membros veem a empresa" on public.organizations for select to authenticated
  using (private.is_listed_member(id));
create policy "owner e admin editam dados da empresa" on public.organizations for update to authenticated
  using (private.has_org_role(id, 'admin')) with check (private.has_org_role(id, 'admin'));

create policy "perfil próprio ou de colegas" on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_org_with(user_id));
create policy "edita o próprio perfil" on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "vínculos próprios ou da empresa" on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(tenant_id));
create policy "admin gerencia membros" on public.organization_members for update to authenticated
  using (private.has_org_role(tenant_id, 'admin')) with check (private.has_org_role(tenant_id, 'admin'));
create policy "admin remove membros ou o próprio usuário sai" on public.organization_members for delete to authenticated
  using (private.has_org_role(tenant_id, 'admin') or user_id = (select auth.uid()));

create policy "admin vê convites" on public.organization_invites for select to authenticated
  using (private.has_org_role(tenant_id, 'admin'));
create policy "admin revoga convites" on public.organization_invites for update to authenticated
  using (private.has_org_role(tenant_id, 'admin') and accepted_at is null)
  with check (private.has_org_role(tenant_id, 'admin'));

create policy "membros veem configurações" on public.organization_settings for select to authenticated
  using (private.is_member(tenant_id));
create policy "admin altera configurações" on public.organization_settings for update to authenticated
  using (private.has_org_role(tenant_id, 'admin')) with check (private.has_org_role(tenant_id, 'admin'));

create policy "planos ativos são visíveis" on public.subscription_plans for select to authenticated
  using (active);

create policy "owner e admin veem a assinatura" on public.subscriptions for select to authenticated
  using (private.has_org_role(tenant_id, 'admin'));
create policy "owner e admin veem o consumo" on public.usage_records for select to authenticated
  using (private.has_org_role(tenant_id, 'admin'));
create policy "owner e admin veem reservas" on public.usage_reservations for select to authenticated
  using (private.has_org_role(tenant_id, 'admin'));
create policy "owner e admin veem a auditoria da empresa" on public.audit_logs for select to authenticated
  using (tenant_id is not null and private.has_org_role(tenant_id, 'admin'));

-- platform_admins e rate_limits: sem policy para authenticated (só service_role).

-- ---------------------------------------------------------------------------
-- Permissões de funções
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  private.org_role(uuid), private.is_member(uuid), private.has_org_role(uuid, public.org_role),
  private.is_listed_member(uuid), private.shares_org_with(uuid), private.is_service_role()
  to authenticated, service_role;
grant execute on function public.create_invite(uuid, text, public.org_role, text), public.accept_invite(text)
  to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated, service_role;
grant execute on function
  public.platform_create_organization(uuid, text, text, text, text, text, text, text, text),
  public.platform_set_organization_status(uuid, uuid, public.org_status, text),
  public.platform_invite_owner(uuid, uuid, text, text, text),
  public.effective_limit(uuid, text),
  public.reserve_usage(uuid, text, numeric, text, integer),
  public.settle_usage(uuid, uuid, numeric, text, uuid),
  public.release_usage(uuid, uuid),
  public.consume_rate_limit(text, integer, integer),
  private.is_platform_admin(uuid),
  private.begin_platform_action(uuid, text),
  private.current_period_month()
  to service_role;

-- Funções criadas no futuro não ficam executáveis por padrão.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dados de referência (não são dados comerciais)
-- ---------------------------------------------------------------------------

-- Plano de uso interno, sem preço. Limites conservadores; métricas de IA e
-- WhatsApp ficam em 0 até as fases que as usam.
insert into public.subscription_plans (code, name, description, entitlements, is_public)
values (
  'internal',
  'Interno',
  'Uso interno das empresas do grupo Perini. Sem cobrança.',
  '{"limits": {"members": 25, "leads": 50000, "agents": 0, "whatsapp_numbers": 0, "ai_cost_usd": 0, "whatsapp_messages": 0}}',
  false
);
