-- PeriniHub Tech: schema editorial do portal de notícias.
-- Migration aditiva: só cria objetos novos (nada é removido ou alterado).
--
-- Modelo de segurança:
-- * O público (anon) só lê categorias ativas e artigos publicados.
-- * Papéis editoriais vêm de admin_profiles (admin | editor), nunca do cliente.
-- * O worker (Trigger.dev) usa a secret key (service_role), que ignora o RLS.
-- * Publicar só é possível pela função news_publish_article, que valida
--   aprovação, verificação, limite diário e é idempotente.
-- * Toda alteração nas tabelas editoriais gera linha em news_audit_logs.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.admin_role as enum ('admin', 'editor');
create type public.news_trust_level as enum ('official', 'high', 'medium', 'low');
create type public.news_verification_status as enum
  ('pending', 'verified', 'partially_verified', 'unverified', 'blocked');
create type public.news_processing_status as enum
  ('new', 'classified', 'duplicate', 'discarded', 'eligible', 'drafted', 'failed', 'dead_letter');
create type public.news_article_status as enum
  ('draft', 'needs_review', 'blocked', 'approved', 'scheduled', 'published', 'rejected', 'archived');
create type public.news_risk_level as enum ('low', 'medium', 'high');
create type public.news_run_status as enum ('running', 'succeeded', 'failed', 'skipped');
create type public.news_claim_status as enum
  ('supported', 'partially_supported', 'unsupported', 'contradicted');
create type public.news_actor_type as enum ('user', 'agent', 'system');

-- ---------------------------------------------------------------------------
-- Papéis administrativos
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- security definer: as policies consultam admin_profiles sem depender do RLS
-- dela própria (evita recursão). search_path vazio contra sequestro de nomes.
create function public.current_admin_role()
returns public.admin_role
language sql stable security definer set search_path = ''
as $$
  select role from public.admin_profiles where user_id = (select auth.uid())
$$;

create function public.is_news_editor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_admin_role() in ('admin', 'editor'), false)
$$;

create function public.is_news_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_admin_role() = 'admin', false)
$$;

-- Chamadas feitas com a secret key chegam com o papel service_role no JWT.
create function public.is_service_role()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role') = 'service_role', false)
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.news_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 300),
  enabled boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  website_url text not null check (website_url ~ '^https://'),
  feed_url text not null unique check (feed_url ~ '^https://'),
  category_id uuid references public.news_categories (id) on delete set null,
  trust_level public.news_trust_level not null default 'medium',
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_status text,
  last_error text,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources (id) on delete restrict,
  original_url text not null check (original_url ~ '^https?://'),
  canonical_url text not null unique check (canonical_url ~ '^https?://'),
  original_title text not null check (char_length(original_title) <= 500),
  summary text check (char_length(summary) <= 5000),
  source_published_at timestamptz,
  fetched_at timestamptz not null default now(),
  -- sha256 do título normalizado: pega a mesma notícia republicada em outra URL.
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  title_tokens text[] not null default '{}',
  relevance_score smallint check (relevance_score between 0 and 100),
  relevance_reason text,
  verification_status public.news_verification_status not null default 'pending',
  processing_status public.news_processing_status not null default 'new',
  duplicate_of uuid references public.news_candidates (id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  -- Lease de processamento: evita que duas execuções tratem o mesmo candidato.
  locked_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (duplicate_of is null or duplicate_of <> id)
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  -- unique: um candidato gera no máximo um artigo (idempotência do writer).
  candidate_id uuid unique references public.news_candidates (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 10 and 160),
  subtitle text check (char_length(subtitle) <= 300),
  excerpt text not null check (char_length(excerpt) between 20 and 400),
  content text not null check (char_length(content) between 200 and 40000),
  cover_image_url text check (cover_image_url ~ '^(https://|/)'),
  cover_image_alt text check (char_length(cover_image_alt) <= 200),
  cover_image_credit text check (char_length(cover_image_credit) <= 200),
  category_id uuid references public.news_categories (id) on delete set null,
  status public.news_article_status not null default 'draft',
  verification_status public.news_verification_status not null default 'pending',
  risk_level public.news_risk_level not null default 'medium',
  -- [{ "title", "url", "publisher", "published_at" }]
  original_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(original_sources) = 'array'),
  -- { "meta_title", "meta_description", "keywords": [], "internal_links": [] }
  seo_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(seo_metadata) = 'object'),
  review_notes text,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  scheduled_for timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(content, '')), 'C')
  ) stored,
  check (status <> 'published' or published_at is not null),
  check (status <> 'scheduled' or scheduled_for is not null)
);

-- Afirmações verificáveis extraídas de cada artigo pelo fact checker.
create table public.news_claims (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles (id) on delete cascade,
  claim text not null check (char_length(claim) <= 1000),
  status public.news_claim_status not null,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  checker_notes text,
  created_at timestamptz not null default now()
);

-- Evidências de cada afirmação: URL, trecho curto e se a fonte é independente.
create table public.news_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.news_claims (id) on delete cascade,
  source_url text not null check (source_url ~ '^https?://'),
  source_title text,
  quote text check (char_length(quote) <= 600),
  supports boolean not null,
  is_independent boolean not null default false,
  retrieved_at timestamptz not null default now()
);

create table public.news_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null check (agent_name in
    ('researcher', 'curator', 'writer', 'fact_checker', 'seo_editor', 'publisher', 'pipeline')),
  run_id text,
  idempotency_key text unique,
  status public.news_run_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  input_reference jsonb not null default '{}'::jsonb,
  output_reference jsonb,
  error_details jsonb,
  provider text,
  model text,
  -- { "input": n, "output": n, "cache_read": n, "cache_write": n }
  token_usage jsonb,
  latency_ms integer check (latency_ms >= 0),
  estimated_cost numeric(12, 6) not null default 0 check (estimated_cost >= 0),
  actual_cost_if_available numeric(12, 6) check (actual_cost_if_available >= 0)
);

-- Linha única (id = 1) com a política editorial.
create table public.news_editorial_settings (
  id smallint primary key default 1 check (id = 1),
  approval_required boolean not null default true,
  auto_publish_enabled boolean not null default false,
  automation_paused boolean not null default false,
  daily_publication_limit smallint not null default 3 check (daily_publication_limit between 0 and 50),
  min_relevance_score smallint not null default 70 check (min_relevance_score between 0 and 100),
  max_candidates_per_run smallint not null default 15 check (max_candidates_per_run between 1 and 100),
  -- null = todas as categorias ativas / todas as fontes ativas.
  allowed_categories uuid[],
  enabled_sources uuid[],
  timezone text not null default 'America/Sao_Paulo',
  schedule_times text[] not null default '{06:00,12:00,17:00}',
  monthly_cost_limit numeric(10, 2) not null default 5 check (monthly_cost_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  -- Horários HH:MM em múltiplos de 5 minutos.
  check (array_to_string(schedule_times, ',') ~ '^([01][0-9]|2[0-3]):[0-5][05](,([01][0-9]|2[0-3]):[0-5][05])*$')
);

-- Modelo de IA por agente, editável no painel.
create table public.news_agent_models (
  agent_name text primary key check (agent_name in
    ('researcher', 'curator', 'writer', 'fact_checker', 'seo_editor')),
  provider text not null default 'anthropic',
  model text not null,
  max_output_tokens integer not null default 2048 check (max_output_tokens between 256 and 32000),
  -- Preço por milhão de tokens (US$), usado para estimar custo antes da chamada.
  input_price_per_mtok numeric(10, 4) not null check (input_price_per_mtok >= 0),
  output_price_per_mtok numeric(10, 4) not null check (output_price_per_mtok >= 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.news_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_type public.news_actor_type not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  "timestamp" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index news_articles_published_idx on public.news_articles (published_at desc)
  where status = 'published';
create index news_articles_category_published_idx on public.news_articles (category_id, published_at desc)
  where status = 'published';
create index news_articles_status_idx on public.news_articles (status, updated_at desc);
create index news_articles_search_idx on public.news_articles using gin (search_vector);
create index news_candidates_status_idx on public.news_candidates (processing_status, fetched_at desc);
create index news_candidates_fingerprint_idx on public.news_candidates (fingerprint);
create index news_candidates_source_idx on public.news_candidates (source_id);
create index news_candidates_duplicate_idx on public.news_candidates (duplicate_of);
create index news_claims_article_idx on public.news_claims (article_id);
create index news_claim_evidence_claim_idx on public.news_claim_evidence (claim_id);
create index news_agent_runs_started_idx on public.news_agent_runs (started_at desc);
create index news_agent_runs_agent_idx on public.news_agent_runs (agent_name, status, started_at desc);
create index news_audit_logs_entity_idx on public.news_audit_logs (entity_type, entity_id, "timestamp" desc);
create index news_audit_logs_timestamp_idx on public.news_audit_logs ("timestamp" desc);
create index news_sources_category_idx on public.news_sources (category_id);
create index news_articles_approved_by_idx on public.news_articles (approved_by);
create index news_editorial_settings_updated_by_idx on public.news_editorial_settings (updated_by);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, regras de status e auditoria
-- ---------------------------------------------------------------------------
create function public.news_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger news_sources_touch before update on public.news_sources
  for each row execute function public.news_touch_updated_at();
create trigger news_candidates_touch before update on public.news_candidates
  for each row execute function public.news_touch_updated_at();
create trigger news_articles_touch before update on public.news_articles
  for each row execute function public.news_touch_updated_at();
create trigger news_settings_touch before update on public.news_editorial_settings
  for each row execute function public.news_touch_updated_at();
create trigger news_agent_models_touch before update on public.news_agent_models
  for each row execute function public.news_touch_updated_at();

-- Regras que valem para qualquer caminho de escrita (painel, worker, SQL):
-- * "published" só é atingido dentro de news_publish_article;
-- * a aprovação registra quem aprovou (o usuário da sessão), sem confiar no cliente;
-- * editar texto de um artigo aprovado/agendado devolve-o para revisão.
create function public.news_articles_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published')
     and coalesce(current_setting('news.publishing', true), '') <> 'on' then
    raise exception 'publish_via_function_only'
      using hint = 'Use public.news_publish_article()', errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.status in ('approved', 'scheduled') and old.status not in ('approved', 'scheduled') then
      new.approved_by := coalesce((select auth.uid()), new.approved_by);
      new.approved_at := now();
    end if;

    if old.status in ('approved', 'scheduled') and new.status = old.status
       and (new.title, new.subtitle, new.excerpt, new.content)
           is distinct from (old.title, old.subtitle, old.excerpt, old.content) then
      new.status := 'needs_review';
      new.approved_by := null;
      new.approved_at := null;
      new.scheduled_for := null;
    end if;

    if new.status not in ('approved', 'scheduled', 'published', 'archived') then
      new.approved_by := null;
      new.approved_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger news_articles_guard before insert or update on public.news_articles
  for each row execute function public.news_articles_guard();

create function public.news_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_action text := lower(tg_op);
  v_uid uuid := (select auth.uid());
begin
  -- O vetor de busca é derivado e enorme: fora do log.
  v_before := v_before - 'search_vector';
  v_after := v_after - 'search_vector';

  if tg_op = 'UPDATE' then
    if v_before = v_after then
      return new;
    end if;
    if (v_before ->> 'status') is distinct from (v_after ->> 'status') then
      v_action := 'status:' || coalesce(v_after ->> 'status', '?');
    elsif (v_before ->> 'processing_status') is distinct from (v_after ->> 'processing_status') then
      v_action := 'processing:' || coalesce(v_after ->> 'processing_status', '?');
    end if;
  end if;

  insert into public.news_audit_logs (actor_id, actor_type, action, entity_type, entity_id, before_state, after_state)
  values (
    v_uid,
    case
      when v_uid is not null then 'user'::public.news_actor_type
      when coalesce(current_setting('news.actor_type', true), '') = 'agent' then 'agent'::public.news_actor_type
      else 'system'::public.news_actor_type
    end,
    v_action,
    tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'agent_name', v_before ->> 'agent_name'),
    v_before,
    v_after
  );

  return coalesce(new, old);
end;
$$;

create trigger news_articles_audit after insert or update or delete on public.news_articles
  for each row execute function public.news_audit();
create trigger news_sources_audit after insert or update or delete on public.news_sources
  for each row execute function public.news_audit();
create trigger news_categories_audit after insert or update or delete on public.news_categories
  for each row execute function public.news_audit();
create trigger news_settings_audit after insert or update on public.news_editorial_settings
  for each row execute function public.news_audit();
create trigger news_agent_models_audit after insert or update or delete on public.news_agent_models
  for each row execute function public.news_audit();
-- Candidatos: só mudanças de status (o volume de inserts da coleta não interessa ao log).
create trigger news_candidates_audit after update of processing_status on public.news_candidates
  for each row execute function public.news_audit();
create trigger admin_profiles_audit after insert or update or delete on public.admin_profiles
  for each row execute function public.news_audit();

-- ---------------------------------------------------------------------------
-- Funções transacionais
-- ---------------------------------------------------------------------------

-- Publica um artigo de forma idempotente. A linha de configuração é travada
-- (FOR UPDATE) para serializar publicações concorrentes e respeitar o limite diário.
-- p_mode: 'manual' (editor no painel) | 'auto' (pipeline).
create function public.news_publish_article(p_article_id uuid, p_mode text default 'manual')
returns public.news_articles
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.news_editorial_settings;
  v_article public.news_articles;
  v_published_today integer;
  v_day_start timestamptz;
begin
  if p_mode not in ('manual', 'auto') then
    raise exception 'invalid_mode' using errcode = 'P0001';
  end if;
  if not (public.is_service_role() or public.is_news_editor()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_mode = 'auto' and not public.is_service_role() then
    raise exception 'auto_mode_requires_service_role' using errcode = '42501';
  end if;

  select * into v_settings from public.news_editorial_settings where id = 1 for update;
  select * into v_article from public.news_articles where id = p_article_id for update;

  if not found then
    raise exception 'article_not_found' using errcode = 'P0002';
  end if;
  if v_article.status = 'published' then
    return v_article; -- idempotente: republicar não duplica nem muda a data
  end if;
  if v_article.status not in ('approved', 'scheduled') then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  if v_article.status = 'scheduled' and v_article.scheduled_for > now() then
    raise exception 'not_due' using errcode = 'P0001';
  end if;
  if v_article.verification_status = 'blocked' and v_article.approved_by is null then
    raise exception 'verification_blocked' using errcode = 'P0001';
  end if;
  if v_article.verification_status <> 'verified' and v_article.approved_by is null then
    raise exception 'verification_required' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.news_claims
    where article_id = p_article_id and status in ('unsupported', 'contradicted')
  ) and v_article.approved_by is null then
    raise exception 'unsupported_claims' using errcode = 'P0001';
  end if;

  if p_mode = 'auto' then
    if v_settings.automation_paused then
      raise exception 'automation_paused' using errcode = 'P0001';
    end if;
    if not v_settings.auto_publish_enabled then
      raise exception 'auto_publish_disabled' using errcode = 'P0001';
    end if;
    if v_settings.approval_required and v_article.approved_by is null then
      raise exception 'approval_required' using errcode = 'P0001';
    end if;
    if v_article.risk_level = 'high' and v_article.approved_by is null then
      raise exception 'high_risk_requires_approval' using errcode = 'P0001';
    end if;
  end if;

  v_day_start := date_trunc('day', now() at time zone v_settings.timezone) at time zone v_settings.timezone;
  select count(*) into v_published_today from public.news_articles
  where status = 'published' and published_at >= v_day_start;
  if v_published_today >= v_settings.daily_publication_limit then
    raise exception 'daily_limit_reached' using errcode = 'P0001';
  end if;

  perform set_config('news.publishing', 'on', true);
  update public.news_articles
  set status = 'published', published_at = now()
  where id = p_article_id
  returning * into v_article;
  perform set_config('news.publishing', '', true);

  return v_article;
end;
$$;

-- Registra o início de uma chamada de agente reservando o custo estimado.
-- Trava as configurações para que execuções paralelas não estourem o teto mensal.
create function public.news_start_agent_run(
  p_agent_name text,
  p_estimated_cost numeric,
  p_input_reference jsonb default '{}'::jsonb,
  p_run_id text default null,
  p_idempotency_key text default null,
  p_provider text default null,
  p_model text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.news_editorial_settings;
  v_spent numeric;
  v_month_start timestamptz;
  v_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_estimated_cost < 0 then
    raise exception 'invalid_cost' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.news_agent_runs
    where idempotency_key = p_idempotency_key and status in ('running', 'succeeded');
    if found then
      raise exception 'duplicate_run' using errcode = 'P0001', detail = v_id::text;
    end if;
    -- Uma tentativa anterior que falhou libera a chave para a nova tentativa.
    update public.news_agent_runs set idempotency_key = null
    where idempotency_key = p_idempotency_key and status in ('failed', 'skipped');
  end if;

  select * into v_settings from public.news_editorial_settings where id = 1 for update;
  if v_settings.automation_paused then
    raise exception 'automation_paused' using errcode = 'P0001';
  end if;

  v_month_start := date_trunc('month', now() at time zone v_settings.timezone) at time zone v_settings.timezone;
  select coalesce(sum(coalesce(actual_cost_if_available, estimated_cost)), 0) into v_spent
  from public.news_agent_runs where started_at >= v_month_start;

  if v_spent + p_estimated_cost > v_settings.monthly_cost_limit then
    raise exception 'budget_exceeded' using errcode = 'P0001',
      detail = format('spent=%s estimated=%s limit=%s', v_spent, p_estimated_cost, v_settings.monthly_cost_limit);
  end if;

  insert into public.news_agent_runs
    (agent_name, run_id, idempotency_key, estimated_cost, input_reference, provider, model)
  values
    (p_agent_name, p_run_id, p_idempotency_key, p_estimated_cost, p_input_reference, p_provider, p_model)
  returning id into v_id;

  return v_id;
end;
$$;

-- Toma o lease de um candidato para uma etapa. Retorna false se outro
-- processo já o detém (lease ainda válido).
create function public.news_claim_candidate(p_candidate_id uuid, p_lease_seconds integer default 600)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_service_role() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.news_candidates
  set locked_until = now() + make_interval(secs => p_lease_seconds), attempts = attempts + 1
  where id = p_candidate_id and (locked_until is null or locked_until < now());
  return found;
end;
$$;

-- Métricas do painel em uma ida ao banco.
create function public.news_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text;
  v_day_start timestamptz;
  v_month_start timestamptz;
  v_result jsonb;
begin
  if not public.is_news_editor() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select timezone into v_tz from public.news_editorial_settings where id = 1;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_day_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;

  select jsonb_build_object(
    'candidates_total', (select count(*) from public.news_candidates),
    'candidates_today', (select count(*) from public.news_candidates where fetched_at >= v_day_start),
    'candidates_eligible', (select count(*) from public.news_candidates where processing_status = 'eligible'),
    'articles_pending', (select count(*) from public.news_articles where status in ('draft', 'needs_review', 'blocked')),
    'articles_approved', (select count(*) from public.news_articles where status in ('approved', 'scheduled')),
    'published_today', (select count(*) from public.news_articles where status = 'published' and published_at >= v_day_start),
    'published_total', (select count(*) from public.news_articles where status = 'published'),
    'cost_today', (select coalesce(sum(coalesce(actual_cost_if_available, estimated_cost)), 0) from public.news_agent_runs where started_at >= v_day_start),
    'cost_month', (select coalesce(sum(coalesce(actual_cost_if_available, estimated_cost)), 0) from public.news_agent_runs where started_at >= v_month_start),
    'tokens_month', (select coalesce(sum(coalesce((token_usage ->> 'input')::bigint, 0) + coalesce((token_usage ->> 'output')::bigint, 0)), 0) from public.news_agent_runs where started_at >= v_month_start),
    'failures_by_agent', (
      select coalesce(jsonb_object_agg(agent_name, n), '{}'::jsonb) from (
        select agent_name, count(*) n from public.news_agent_runs
        where status = 'failed' and started_at >= now() - interval '7 days' group by agent_name
      ) f
    ),
    'last_run', (
      select to_jsonb(r) from (
        select agent_name, status, started_at, finished_at from public.news_agent_runs
        order by started_at desc limit 1
      ) r
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.news_categories enable row level security;
alter table public.news_sources enable row level security;
alter table public.news_candidates enable row level security;
alter table public.news_articles enable row level security;
alter table public.news_claims enable row level security;
alter table public.news_claim_evidence enable row level security;
alter table public.news_agent_runs enable row level security;
alter table public.news_editorial_settings enable row level security;
alter table public.news_agent_models enable row level security;
alter table public.news_audit_logs enable row level security;

-- Grants explícitos (não depender da exposição automática de tabelas novas);
-- o que cada papel enxerga de fato é decidido pelas policies abaixo.
grant usage on schema public to anon, authenticated, service_role;
grant select on
  public.admin_profiles, public.news_categories, public.news_sources, public.news_candidates,
  public.news_articles, public.news_claims, public.news_claim_evidence, public.news_agent_runs,
  public.news_editorial_settings, public.news_agent_models, public.news_audit_logs
to anon, authenticated;
grant insert, update, delete on
  public.admin_profiles, public.news_categories, public.news_sources, public.news_candidates,
  public.news_articles, public.news_editorial_settings, public.news_agent_models
to authenticated;
grant all on
  public.admin_profiles, public.news_categories, public.news_sources, public.news_candidates,
  public.news_articles, public.news_claims, public.news_claim_evidence, public.news_agent_runs,
  public.news_editorial_settings, public.news_agent_models, public.news_audit_logs
to service_role;

-- Defesa em profundidade: anon nunca escreve, mesmo que uma policy seja criada por engano.
revoke insert, update, delete, truncate on
  public.admin_profiles, public.news_categories, public.news_sources, public.news_candidates,
  public.news_articles, public.news_claims, public.news_claim_evidence, public.news_agent_runs,
  public.news_editorial_settings, public.news_agent_models, public.news_audit_logs
from anon;
-- Logs são append-only também para usuários logados (só o trigger escreve).
revoke insert, update, delete, truncate on public.news_audit_logs from authenticated;
revoke insert, update, delete, truncate on public.news_agent_runs from authenticated;
revoke insert, update, delete, truncate on public.news_claims, public.news_claim_evidence from authenticated;

create policy "perfil próprio ou admin" on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_news_admin()));
create policy "admin gerencia papéis" on public.admin_profiles for all to authenticated
  using ((select public.is_news_admin())) with check ((select public.is_news_admin()));

create policy "categorias ativas são públicas" on public.news_categories for select to anon, authenticated
  using (enabled or (select public.is_news_editor()));
create policy "admin gerencia categorias" on public.news_categories for all to authenticated
  using ((select public.is_news_admin())) with check ((select public.is_news_admin()));

create policy "artigos publicados são públicos" on public.news_articles for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select public.is_news_editor()));
create policy "editores revisam artigos" on public.news_articles for update to authenticated
  using ((select public.is_news_editor())) with check ((select public.is_news_editor()));
create policy "admin remove artigos" on public.news_articles for delete to authenticated
  using ((select public.is_news_admin()));

create policy "editores leem fontes" on public.news_sources for select to authenticated
  using ((select public.is_news_editor()));
create policy "admin gerencia fontes" on public.news_sources for all to authenticated
  using ((select public.is_news_admin())) with check ((select public.is_news_admin()));

create policy "editores leem candidatos" on public.news_candidates for select to authenticated
  using ((select public.is_news_editor()));
create policy "editores reprocessam candidatos" on public.news_candidates for update to authenticated
  using ((select public.is_news_editor())) with check ((select public.is_news_editor()));

create policy "editores leem verificações" on public.news_claims for select to authenticated
  using ((select public.is_news_editor()));
create policy "editores leem evidências" on public.news_claim_evidence for select to authenticated
  using ((select public.is_news_editor()));
create policy "editores leem execuções" on public.news_agent_runs for select to authenticated
  using ((select public.is_news_editor()));
create policy "editores leem auditoria" on public.news_audit_logs for select to authenticated
  using ((select public.is_news_editor()));

create policy "editores leem configurações" on public.news_editorial_settings for select to authenticated
  using ((select public.is_news_editor()));
create policy "admin altera configurações" on public.news_editorial_settings for update to authenticated
  using ((select public.is_news_admin())) with check ((select public.is_news_admin()));

create policy "editores leem modelos" on public.news_agent_models for select to authenticated
  using ((select public.is_news_editor()));
create policy "admin altera modelos" on public.news_agent_models for update to authenticated
  using ((select public.is_news_admin())) with check ((select public.is_news_admin()));

-- Funções: ninguém executa por padrão; libera só quem precisa.
revoke execute on function
  public.current_admin_role(), public.is_news_editor(), public.is_news_admin(), public.is_service_role(),
  public.news_publish_article(uuid, text),
  public.news_start_agent_run(text, numeric, jsonb, text, text, text, text),
  public.news_claim_candidate(uuid, integer),
  public.news_dashboard_stats()
from public, anon;
grant execute on function
  public.current_admin_role(), public.is_news_editor(), public.is_news_admin(), public.is_service_role(),
  public.news_publish_article(uuid, text), public.news_dashboard_stats()
to authenticated;
grant execute on function
  public.current_admin_role(), public.is_news_editor(), public.is_news_admin(), public.is_service_role(),
  public.news_publish_article(uuid, text),
  public.news_start_agent_run(text, numeric, jsonb, text, text, text, text),
  public.news_claim_candidate(uuid, integer),
  public.news_dashboard_stats()
to service_role;
-- O RLS de anon avalia is_news_editor() nas policies públicas.
grant execute on function public.is_news_editor(), public.current_admin_role() to anon;
