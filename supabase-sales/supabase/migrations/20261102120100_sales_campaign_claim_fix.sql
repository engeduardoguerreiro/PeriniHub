-- Correção da Fase 5 (encontrada pelo teste de limite por hora): em
-- "UPDATE ... WHERE id IN (SELECT ... LIMIT n FOR UPDATE SKIP LOCKED)" o
-- Postgres pode reavaliar a subconsulta e reservar mais que n linhas. Com a
-- CTE materializada o lote é escolhido uma única vez.

create or replace function public.campaign_claim_recipients(p_campaign uuid, p_limit integer)
returns setof public.campaign_recipients
language sql security definer set search_path = ''
as $$
  with picked as materialized (
    select id from public.campaign_recipients
    where campaign_id = p_campaign and eligibility = 'eligible' and status = 'pending'
    order by id
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update public.campaign_recipients r set status = 'processing'
  from picked
  where r.id = picked.id
  returning r.*
$$;

revoke execute on function public.campaign_claim_recipients(uuid, integer) from public, anon, authenticated;
grant execute on function public.campaign_claim_recipients(uuid, integer) to service_role;
