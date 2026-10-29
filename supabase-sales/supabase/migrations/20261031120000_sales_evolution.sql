-- PeriniHub AI Sales — Fase 3.1: conexão não oficial pela Evolution API
-- (decisão D-17), ao lado da Cloud API oficial.
--
-- Regras para números Evolution (não oficial, risco de banimento):
-- * respostas a quem escreveu (janela de 24 h): normais;
-- * mensagem para quem não escreveu (proativa): só manual (origem "user"),
--   com consentimento vigente, fora da supressão, no máximo 2 por contato em
--   7 dias e limite diário por número (padrão 10, máximo 30);
-- * campanhas, follow-up e agentes não iniciam conversa por Evolution;
-- * templates não existem na Evolution.

alter type public.whatsapp_provider add value if not exists 'evolution';

alter table public.whatsapp_phone_numbers drop constraint whatsapp_phone_numbers_phone_number_id_check;
alter table public.whatsapp_phone_numbers add constraint whatsapp_phone_numbers_phone_number_id_check
  check (phone_number_id ~ '^([0-9]{5,30}|sandbox-[a-z0-9-]{4,40}|evolution-[a-z0-9-]{4,60})$');

alter table public.organization_settings
  add column evolution_daily_proactive_limit smallint not null default 10 check (evolution_daily_proactive_limit between 0 and 30);
grant update (evolution_daily_proactive_limit) on public.organization_settings to authenticated;

-- Marca envios que iniciam conversa (template oficial ou proativo pela Evolution).
alter table public.message_send_requests add column proactive boolean not null default false;
create index message_send_requests_proactive_idx on public.message_send_requests (tenant_id, phone_number_id, created_at desc) where proactive and decision = 'allowed';

create or replace function public.whatsapp_send_gate(
  p_tenant uuid,
  p_contact uuid,
  p_phone_number uuid,
  p_kind public.send_kind,
  p_origin public.send_origin,
  p_idempotency_key text,
  p_body text default null,
  p_template uuid default null,
  p_purpose public.consent_purpose default null,
  p_campaign_active boolean default true
)
returns public.message_send_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_existing public.message_send_requests;
  v_contact public.contacts;
  v_number public.whatsapp_phone_numbers;
  v_provider text;
  v_conversation public.conversations;
  v_template public.whatsapp_templates;
  v_suppressed_at timestamptz;
  v_checks jsonb := '{}';
  v_allowed boolean;
  v_in_window boolean;
  v_proactive boolean;
  v_recent integer;
  v_today integer;
  v_daily_limit integer;
  v_row public.message_send_requests;
begin
  if not (private.is_service_role() or private.has_org_role(p_tenant, 'sales')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_existing from public.message_send_requests where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return v_existing;
  end if;

  select * into v_contact from public.contacts where id = p_contact and tenant_id = p_tenant and deleted_at is null;
  select * into v_number from public.whatsapp_phone_numbers where id = p_phone_number and tenant_id = p_tenant;
  if v_contact.id is null or v_number.id is null then
    raise exception 'invalid_target' using errcode = 'P0002';
  end if;
  select provider::text into v_provider from public.whatsapp_accounts where id = v_number.account_id;
  select * into v_conversation from public.conversations
  where tenant_id = p_tenant and contact_id = p_contact and phone_number_id = p_phone_number and status <> 'closed';
  v_in_window := v_conversation.last_inbound_at is not null and v_conversation.last_inbound_at > now() - interval '24 hours';
  -- Proativo = a empresa inicia (ou retoma fora da janela) a conversa.
  v_proactive := p_kind = 'template' or not v_in_window;

  -- Empresa, número e contato.
  v_checks := v_checks || jsonb_build_object('organization_active', jsonb_build_object('ok',
    exists (select 1 from public.organizations where id = p_tenant and status = 'active')));
  v_checks := v_checks || jsonb_build_object('number_active', jsonb_build_object('ok', v_number.status = 'active', 'status', v_number.status));
  v_checks := v_checks || jsonb_build_object('has_phone', jsonb_build_object('ok', v_contact.phone_e164 is not null));

  -- Supressão: vale até o contato voltar a escrever depois do descadastro.
  select created_at into v_suppressed_at from public.suppression_list
  where tenant_id = p_tenant and channel = 'whatsapp' and identifier = v_contact.phone_e164;
  v_checks := v_checks || jsonb_build_object('suppression', jsonb_build_object('ok',
    v_suppressed_at is null or (not v_proactive and v_conversation.last_inbound_at > v_suppressed_at),
    'suppressed_at', v_suppressed_at));

  if p_kind = 'free_text' then
    v_checks := v_checks || jsonb_build_object('body', jsonb_build_object('ok', p_body is not null and char_length(btrim(p_body)) between 1 and 4096));
  end if;

  if v_provider = 'evolution' then
    v_checks := v_checks || jsonb_build_object('provider_kind', jsonb_build_object('ok', p_kind = 'free_text', 'provider', v_provider));
    if v_proactive then
      -- Não oficial: só envio manual, com consentimento e volume baixo.
      v_checks := v_checks || jsonb_build_object('manual_only', jsonb_build_object('ok', p_origin = 'user', 'origin', p_origin));
      v_checks := v_checks || jsonb_build_object('consent', jsonb_build_object('ok', exists (
        select 1 from public.current_consents cc
        where cc.tenant_id = p_tenant and cc.contact_id = p_contact and cc.channel = 'whatsapp' and cc.is_valid
          and cc.purpose = any (array[coalesce(p_purpose, 'sales_followup'::public.consent_purpose), 'marketing'::public.consent_purpose])
      ), 'purpose', coalesce(p_purpose, 'sales_followup'::public.consent_purpose)));
      select coalesce(evolution_daily_proactive_limit, 10) into v_daily_limit from public.organization_settings where tenant_id = p_tenant;
      select count(*) into v_today from public.message_send_requests
      where tenant_id = p_tenant and phone_number_id = p_phone_number and proactive and decision = 'allowed' and created_at > now() - interval '24 hours';
      v_checks := v_checks || jsonb_build_object('daily_limit', jsonb_build_object('ok', v_today < coalesce(v_daily_limit, 10), 'last_24h', v_today, 'limit', coalesce(v_daily_limit, 10)));
    end if;
  elsif p_kind = 'free_text' then
    -- Oficial: mensagem livre só dentro da janela de 24 h.
    v_checks := v_checks || jsonb_build_object('service_window', jsonb_build_object('ok', v_in_window, 'last_inbound_at', v_conversation.last_inbound_at));
  else
    select * into v_template from public.whatsapp_templates where id = p_template and tenant_id = p_tenant and account_id = v_number.account_id;
    v_checks := v_checks || jsonb_build_object('template_approved', jsonb_build_object('ok', v_template.id is not null and upper(v_template.status) = 'APPROVED'));
    v_checks := v_checks || jsonb_build_object('consent', jsonb_build_object('ok', exists (
      select 1 from public.current_consents cc
      where cc.tenant_id = p_tenant and cc.contact_id = p_contact and cc.channel = 'whatsapp' and cc.is_valid
        and (case when v_template.category = 'marketing' then cc.purpose = 'marketing'
                  else cc.purpose = coalesce(p_purpose, cc.purpose) end)
    ), 'purpose', coalesce(p_purpose, case when v_template.category = 'marketing' then 'marketing'::public.consent_purpose end)));
  end if;

  if v_proactive then
    -- Frequência por contato: no máximo 2 mensagens proativas em 7 dias.
    select count(*) into v_recent from public.message_send_requests
    where tenant_id = p_tenant and contact_id = p_contact and proactive and decision = 'allowed' and created_at > now() - interval '7 days';
    v_checks := v_checks || jsonb_build_object('frequency', jsonb_build_object('ok', v_recent < 2, 'last_7_days', v_recent));
  end if;

  v_checks := v_checks || jsonb_build_object('campaign_active', jsonb_build_object('ok', p_campaign_active));
  select bool_and((value ->> 'ok')::boolean) into v_allowed from jsonb_each(v_checks);

  insert into public.message_send_requests (
    tenant_id, contact_id, conversation_id, phone_number_id, origin, kind, purpose, template_id, body,
    idempotency_key, decision, checks, status, proactive, created_by, finished_at
  ) values (
    p_tenant, p_contact, v_conversation.id, p_phone_number, p_origin, p_kind, p_purpose, p_template, p_body,
    p_idempotency_key, case when v_allowed then 'allowed' else 'blocked' end::public.send_decision, v_checks,
    case when v_allowed then 'pending' else 'blocked' end, v_proactive, (select auth.uid()),
    case when v_allowed then null else now() end
  ) returning * into v_row;
  return v_row;
end;
$$;

-- Estado da conexão vindo do servidor Evolution (CONNECTION_UPDATE).
create function public.whatsapp_set_connection_state(p_phone_number_id text, p_status public.whatsapp_status)
returns void
language sql security definer set search_path = ''
as $$
  with number as (
    update public.whatsapp_phone_numbers set status = p_status
    where phone_number_id = p_phone_number_id and status <> 'disconnected'
    returning account_id
  )
  update public.whatsapp_accounts set status = p_status where id in (select account_id from number)
$$;

revoke execute on function public.whatsapp_set_connection_state(text, public.whatsapp_status) from public, anon, authenticated;
grant execute on function public.whatsapp_set_connection_state(text, public.whatsapp_status) to service_role;
