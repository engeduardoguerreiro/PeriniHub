-- PeriniHub AI Sales — Fase 8: retenção de dados operacionais.
--
-- Prazos de plataforma (DATABASE.md §6), aplicados diariamente pela tarefa
-- ai-sales-retention em lotes. Só dados operacionais: payload de webhooks,
-- conteúdo das execuções de agentes, janelas de limite de tentativas e
-- convites vencidos. Anonimizar mensagens e leads inativos depende da
-- revisão jurídica (D-10) e não está ativo.

create table public.retention_policies (
  entity text primary key check (entity in ('webhook_payload', 'webhook_events', 'agent_content', 'rate_limits', 'stale_invites')),
  retain_days integer not null check (retain_days between 1 and 3650),
  description text not null,
  updated_at timestamptz not null default now()
);

insert into public.retention_policies (entity, retain_days, description) values
  ('webhook_payload', 30, 'Apaga o payload (conteúdo) de webhooks já tratados; mantém os metadados.'),
  ('webhook_events', 180, 'Apaga o registro do webhook.'),
  ('agent_content', 90, 'Apaga entrada, saída e argumentos de ferramentas das execuções; mantém custo, status e tempo.'),
  ('rate_limits', 1, 'Apaga janelas antigas do limite de tentativas.'),
  ('stale_invites', 30, 'Apaga convites não aceitos vencidos ou revogados há mais desse prazo.');

create trigger retention_policies_updated_at before update on public.retention_policies for each row execute function private.set_updated_at();
create trigger retention_policies_audit after update on public.retention_policies for each row execute function private.audit_change();

alter table public.retention_policies enable row level security;
revoke all on public.retention_policies from anon, authenticated;
grant all on public.retention_policies to service_role;

create function private.retention_days(p_entity text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select retain_days from public.retention_policies where entity = p_entity
$$;

-- Um lote por entidade a cada chamada (p_batch linhas no máximo); a tarefa
-- chama de novo enquanto houver trabalho. Devolve o que foi feito.
create function public.apply_retention(p_batch integer default 1000)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch integer := least(greatest(p_batch, 1), 5000);
  v_payloads integer;
  v_events integer;
  v_executions integer;
  v_tool_calls integer;
  v_rate integer;
  v_invites integer;
begin
  with target as (
    select id from public.webhook_events
    where received_at < now() - make_interval(days => private.retention_days('webhook_payload'))
      and status in ('processed', 'ignored', 'dead_letter') and payload <> '{}'::jsonb
    limit v_batch
  )
  update public.webhook_events w set payload = '{}'::jsonb from target where w.id = target.id;
  get diagnostics v_payloads = row_count;

  with target as (
    select id from public.webhook_events
    where received_at < now() - make_interval(days => private.retention_days('webhook_events'))
    limit v_batch
  )
  delete from public.webhook_events w using target where w.id = target.id;
  get diagnostics v_events = row_count;

  with target as (
    select id from public.agent_executions
    where started_at < now() - make_interval(days => private.retention_days('agent_content'))
      and status <> 'running' and (output is not null or input_summary <> '{}'::jsonb)
    limit v_batch
  )
  update public.agent_executions e set output = null, input_summary = '{}'::jsonb from target where e.id = target.id;
  get diagnostics v_executions = row_count;

  with target as (
    select id from public.agent_tool_calls
    where created_at < now() - make_interval(days => private.retention_days('agent_content')) and arguments <> '{}'::jsonb
    limit v_batch
  )
  update public.agent_tool_calls t set arguments = '{}'::jsonb, result = null from target where t.id = target.id;
  get diagnostics v_tool_calls = row_count;

  with target as (
    select bucket_key, window_start from public.rate_limits
    where window_start < now() - make_interval(days => private.retention_days('rate_limits'))
    limit v_batch
  )
  delete from public.rate_limits r using target where r.bucket_key = target.bucket_key and r.window_start = target.window_start;
  get diagnostics v_rate = row_count;

  with target as (
    select id from public.organization_invites
    where accepted_at is null
      and coalesce(revoked_at, expires_at) < now() - make_interval(days => private.retention_days('stale_invites'))
    limit v_batch
  )
  delete from public.organization_invites i using target where i.id = target.id;
  get diagnostics v_invites = row_count;

  return jsonb_build_object('webhook_payloads', v_payloads, 'webhook_events', v_events, 'agent_executions', v_executions,
                            'agent_tool_calls', v_tool_calls, 'rate_limits', v_rate, 'invites', v_invites);
end;
$$;

revoke execute on function public.apply_retention(integer) from public, anon, authenticated;
revoke execute on function private.retention_days(text) from public, anon, authenticated;
grant execute on function public.apply_retention(integer), private.retention_days(text) to service_role;
