-- Correção da Fase 2: o autor (actor_type) calculado com CASE saía como
-- texto; as funções abaixo passam a converter para o enum.

create or replace function private.audit_soft_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    insert into public.audit_logs (tenant_id, actor_type, actor_id, action, entity_type, entity_id)
    values (new.tenant_id, case when (select auth.uid()) is null then 'system' else 'user' end::public.actor_type, (select auth.uid()),
            case when new.deleted_at is null then 'restore' else 'soft_delete' end, tg_table_name, new.id::text);
  end if;
  return new;
end;
$$;

create or replace function private.lead_stage_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_from text;
  v_to text;
begin
  if tg_op = 'INSERT' then
    insert into public.activities (tenant_id, lead_id, contact_id, kind, body, actor_type, actor_id)
    values (new.tenant_id, new.id, new.contact_id, 'system', 'Lead criado.', case when (select auth.uid()) is null then 'system' else 'user' end::public.actor_type, (select auth.uid()));
    return new;
  end if;
  if new.stage_id is distinct from old.stage_id then
    select name into v_from from public.pipeline_stages where id = old.stage_id;
    select name into v_to from public.pipeline_stages where id = new.stage_id;
    insert into public.activities (tenant_id, lead_id, contact_id, kind, body, metadata, actor_type, actor_id)
    values (new.tenant_id, new.id, new.contact_id, 'stage_change', format('Etapa: %s → %s', v_from, v_to),
            jsonb_build_object('from_stage_id', old.stage_id, 'to_stage_id', new.stage_id),
            case when (select auth.uid()) is null then 'system' else 'user' end::public.actor_type, (select auth.uid()));
  end if;
  return new;
end;
$$;

create or replace function private.consent_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activities (tenant_id, contact_id, kind, body, metadata, actor_type, actor_id)
  values (new.tenant_id, new.contact_id, 'consent_change',
          format('Consentimento %s: %s / %s (%s)', case when new.status = 'granted' then 'registrado' else 'revogado' end, new.channel, new.purpose, new.source),
          jsonb_build_object('consent_id', new.id, 'status', new.status, 'channel', new.channel, 'purpose', new.purpose),
          case when new.recorded_by is null then 'system' else 'user' end::public.actor_type, new.recorded_by);
  return new;
end;
$$;
