-- PeriniHub AI Sales — Fase 4: agentes de IA e base de conhecimento.
--
-- Princípios (docs/ai-sales/SECURITY.md §7):
-- * IA sugere, sistema executa: o modelo devolve uma proposta estruturada;
--   o código aplica só ações do catálogo, com registro em agent_tool_calls;
-- * versões imutáveis (rollback = apontar para versão anterior);
-- * custo reservado antes de cada chamada (reserve_usage, métrica ai_cost_usd);
-- * conhecimento isolado por empresa; respostas citam os trechos usados.

create type public.agent_type as enum ('sdr', 'capture', 'followup', 'analyst');
create type public.agent_status as enum ('active', 'inactive', 'testing');
create type public.execution_status as enum ('running', 'succeeded', 'failed', 'skipped');
create type public.tool_decision as enum ('executed', 'rejected', 'needs_approval');

-- ---------------------------------------------------------------------------
-- Agentes e versões
-- ---------------------------------------------------------------------------

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  type public.agent_type not null,
  name text not null check (char_length(name) between 2 and 80),
  objective text check (objective is null or char_length(objective) <= 1000),
  status public.agent_status not null default 'testing',
  current_version_id uuid,
  -- SDR: número de WhatsApp em que atende.
  phone_number_id uuid,
  auto_take_new_conversations boolean not null default false,
  -- Abaixo desta confiança, a conversa vai para um humano.
  handoff_confidence numeric(3, 2) not null default 0.60 check (handoff_confidence between 0 and 1),
  max_replies_per_conversation integer not null default 10 check (max_replies_per_conversation between 1 and 50),
  daily_executions_limit integer not null default 200 check (daily_executions_limit between 1 and 5000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id) on delete set null (phone_number_id),
  unique (tenant_id, id)
);
-- Um SDR ativo por número.
create unique index ai_agents_active_sdr_key on public.ai_agents (phone_number_id) where type = 'sdr' and status = 'active' and phone_number_id is not null;

create table public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  agent_id uuid not null,
  version integer not null check (version >= 1),
  system_prompt text not null check (char_length(system_prompt) between 20 and 12000),
  provider text not null check (provider in ('anthropic', 'mock')),
  model text not null check (char_length(model) between 2 and 80),
  max_output_tokens integer not null default 1200 check (max_output_tokens between 256 and 4000),
  input_price_per_mtok numeric(10, 4) not null default 0 check (input_price_per_mtok >= 0),
  output_price_per_mtok numeric(10, 4) not null default 0 check (output_price_per_mtok >= 0),
  knowledge_base_ids uuid[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, agent_id) references public.ai_agents (tenant_id, id) on delete cascade,
  unique (agent_id, version),
  unique (tenant_id, id)
);
alter table public.ai_agents add constraint ai_agents_current_version_fkey
  foreign key (tenant_id, current_version_id) references public.agent_versions (tenant_id, id) on delete set null (current_version_id);

create table public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid not null,
  version_id uuid not null,
  trigger_type text not null check (trigger_type in ('inbound_message', 'manual', 'test', 'schedule')),
  trigger_ref text,
  idempotency_key text not null check (char_length(idempotency_key) between 4 and 200),
  is_test boolean not null default false,
  status public.execution_status not null default 'running',
  input_summary jsonb not null default '{}',
  output jsonb,
  token_usage jsonb,
  estimated_cost_usd numeric(12, 6),
  cost_usd numeric(12, 6),
  latency_ms integer,
  error text check (error is null or char_length(error) <= 1000),
  reservation_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (tenant_id, agent_id) references public.ai_agents (tenant_id, id) on delete cascade,
  foreign key (tenant_id, version_id) references public.agent_versions (tenant_id, id) on delete cascade,
  -- Mesma mensagem recebida nunca gera duas execuções (sem resposta duplicada).
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);
create index agent_executions_agent_idx on public.agent_executions (tenant_id, agent_id, started_at desc);

create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  execution_id uuid not null,
  tool text not null check (char_length(tool) between 3 and 60),
  arguments jsonb not null default '{}',
  decision public.tool_decision not null,
  result text check (result is null or char_length(result) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, execution_id) references public.agent_executions (tenant_id, id) on delete cascade
);
create index agent_tool_calls_execution_idx on public.agent_tool_calls (tenant_id, execution_id);

create table public.agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid not null,
  execution_id uuid,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, conversation_id) references public.conversations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, execution_id) references public.agent_executions (tenant_id, id) on delete set null (execution_id),
  unique (tenant_id, id)
);
create index agent_handoffs_open_idx on public.agent_handoffs (tenant_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Base de conhecimento (busca textual em português; embeddings ficam para D-06)
-- ---------------------------------------------------------------------------

create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  knowledge_base_id uuid not null,
  title text not null check (char_length(title) between 2 and 200),
  content text not null check (char_length(content) between 1 and 200000),
  chunk_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, knowledge_base_id) references public.knowledge_bases (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  knowledge_base_id uuid not null,
  chunk_index integer not null,
  content text not null check (char_length(content) between 1 and 4000),
  fts tsvector generated always as (to_tsvector('portuguese', content)) stored,
  foreign key (tenant_id, document_id) references public.knowledge_documents (tenant_id, id) on delete cascade,
  unique (document_id, chunk_index)
);
create index knowledge_chunks_fts_idx on public.knowledge_chunks using gin (fts);
create index knowledge_chunks_tenant_idx on public.knowledge_chunks (tenant_id, knowledge_base_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger ai_agents_updated_at before update on public.ai_agents for each row execute function private.set_updated_at();
create trigger knowledge_documents_updated_at before update on public.knowledge_documents for each row execute function private.set_updated_at();
create trigger ai_agents_audit after insert or update or delete on public.ai_agents for each row execute function private.audit_change();
create trigger agent_versions_audit after insert on public.agent_versions for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Nova versão do agente (imutável) e passa a ser a atual. Admin ou acima.
create function public.create_agent_version(
  p_tenant uuid,
  p_agent uuid,
  p_system_prompt text,
  p_provider text,
  p_model text,
  p_max_output_tokens integer,
  p_input_price numeric,
  p_output_price numeric,
  p_knowledge_base_ids uuid[],
  p_notes text default null
)
returns public.agent_versions
language plpgsql security definer set search_path = ''
as $$
declare
  v_next integer;
  v_row public.agent_versions;
begin
  if not (private.has_org_role(p_tenant, 'admin') or private.is_service_role()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ai_agents where id = p_agent and tenant_id = p_tenant) then
    raise exception 'agent_not_found' using errcode = 'P0002';
  end if;
  -- Bases de conhecimento só da própria empresa.
  if exists (select 1 from unnest(coalesce(p_knowledge_base_ids, '{}')) kb
             where not exists (select 1 from public.knowledge_bases b where b.id = kb and b.tenant_id = p_tenant)) then
    raise exception 'invalid_knowledge_base' using errcode = '23503';
  end if;
  perform 1 from public.ai_agents where id = p_agent for update;
  select coalesce(max(version), 0) + 1 into v_next from public.agent_versions where agent_id = p_agent;
  insert into public.agent_versions (tenant_id, agent_id, version, system_prompt, provider, model, max_output_tokens,
                                     input_price_per_mtok, output_price_per_mtok, knowledge_base_ids, notes, created_by)
  values (p_tenant, p_agent, v_next, p_system_prompt, p_provider, p_model, p_max_output_tokens,
          p_input_price, p_output_price, coalesce(p_knowledge_base_ids, '{}'), p_notes, (select auth.uid()))
  returning * into v_row;
  update public.ai_agents set current_version_id = v_row.id where id = p_agent;
  return v_row;
end;
$$;

-- Busca no conhecimento da empresa (RLS do chamador vale; tenant também no filtro).
create function public.search_knowledge(p_tenant uuid, p_query text, p_knowledge_base_ids uuid[], p_limit integer default 5)
returns table (id uuid, document_id uuid, title text, content text, rank real)
language sql stable security invoker set search_path = ''
as $$
  with query as (
    -- OR entre os termos: mensagens de clientes raramente casam todas as palavras.
    select to_tsquery('portuguese', string_agg(lexeme, ' | ')) as q
    from unnest(tsvector_to_array(to_tsvector('portuguese', left(coalesce(p_query, ''), 500)))) as lexeme
  )
  select c.id, c.document_id, d.title, c.content, ts_rank(c.fts, query.q) as rank
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  cross join query
  where c.tenant_id = p_tenant
    and query.q is not null
    and (cardinality(coalesce(p_knowledge_base_ids, '{}')) = 0 or c.knowledge_base_id = any (p_knowledge_base_ids))
    and c.fts @@ query.q
  order by rank desc
  limit least(greatest(coalesce(p_limit, 5), 1), 10)
$$;

-- Plano interno: libera os 4 agentes e um teto conservador de IA (US$ 5/mês)
-- até a decisão D-04 (orçamento do AI Sales).
update public.subscription_plans
set entitlements = jsonb_set(jsonb_set(entitlements, '{limits,agents}', '4'), '{limits,ai_cost_usd}', '5')
where code = 'internal';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ai_agents enable row level security;
alter table public.agent_versions enable row level security;
alter table public.agent_executions enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_handoffs enable row level security;
alter table public.knowledge_bases enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

revoke all on public.ai_agents, public.agent_versions, public.agent_executions, public.agent_tool_calls, public.agent_handoffs,
  public.knowledge_bases, public.knowledge_documents, public.knowledge_chunks from anon, authenticated;
grant all on public.ai_agents, public.agent_versions, public.agent_executions, public.agent_tool_calls, public.agent_handoffs,
  public.knowledge_bases, public.knowledge_documents, public.knowledge_chunks to service_role;

grant select on public.ai_agents, public.agent_versions, public.agent_executions, public.agent_tool_calls, public.agent_handoffs,
  public.knowledge_bases, public.knowledge_documents, public.knowledge_chunks to authenticated;
grant insert (tenant_id, type, name, objective, status, phone_number_id, auto_take_new_conversations, handoff_confidence,
              max_replies_per_conversation, daily_executions_limit, created_by) on public.ai_agents to authenticated;
grant update (name, objective, status, current_version_id, phone_number_id, auto_take_new_conversations, handoff_confidence,
              max_replies_per_conversation, daily_executions_limit) on public.ai_agents to authenticated;
grant update (status, resolved_by, resolved_at) on public.agent_handoffs to authenticated;
grant insert, update, delete on public.knowledge_bases, public.knowledge_documents, public.knowledge_chunks to authenticated;

create policy "membros veem agentes" on public.ai_agents for select to authenticated using (private.is_member(tenant_id));
create policy "admin cria agentes" on public.ai_agents for insert to authenticated with check (private.has_org_role(tenant_id, 'admin'));
create policy "admin configura agentes" on public.ai_agents for update to authenticated
  using (private.has_org_role(tenant_id, 'admin')) with check (private.has_org_role(tenant_id, 'admin'));
create policy "gestor vê versões" on public.agent_versions for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor vê execuções" on public.agent_executions for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "gestor vê ações dos agentes" on public.agent_tool_calls for select to authenticated using (private.has_org_role(tenant_id, 'manager'));
create policy "atendentes veem transferências" on public.agent_handoffs for select to authenticated using (private.has_org_role(tenant_id, 'sales'));
create policy "atendentes resolvem transferências" on public.agent_handoffs for update to authenticated
  using (private.has_org_role(tenant_id, 'sales')) with check (private.has_org_role(tenant_id, 'sales'));

create policy "atendentes leem conhecimento" on public.knowledge_bases for select to authenticated using (private.has_org_role(tenant_id, 'sales'));
create policy "gestor mantém bases" on public.knowledge_bases for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "atendentes leem documentos" on public.knowledge_documents for select to authenticated using (private.has_org_role(tenant_id, 'sales'));
create policy "gestor mantém documentos" on public.knowledge_documents for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));
create policy "atendentes leem trechos" on public.knowledge_chunks for select to authenticated using (private.has_org_role(tenant_id, 'sales'));
create policy "gestor mantém trechos" on public.knowledge_chunks for all to authenticated
  using (private.has_org_role(tenant_id, 'manager')) with check (private.has_org_role(tenant_id, 'manager'));

-- Funções novas: sem PUBLIC (lição da migration 20261030120200).
revoke execute on function public.create_agent_version(uuid, uuid, text, text, text, integer, numeric, numeric, uuid[], text),
  public.search_knowledge(uuid, text, uuid[], integer) from public, anon;
grant execute on function public.create_agent_version(uuid, uuid, text, text, text, integer, numeric, numeric, uuid[], text),
  public.search_knowledge(uuid, text, uuid[], integer) to authenticated, service_role;
