-- Correção da Fase 3: CASE em colunas de enum (direção, status, decisão)
-- saía como texto; as funções passam a converter explicitamente.

create or replace function public.whatsapp_record_inbound(
  p_phone_number_id text,
  p_from_e164 text,
  p_profile_name text,
  p_wa_message_id text,
  p_type text,
  p_body text,
  p_media jsonb,
  p_occurred_at timestamptz,
  p_sender public.message_sender default 'contact'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_number public.whatsapp_phone_numbers;
  v_contact uuid;
  v_conversation public.conversations;
  v_message uuid;
  v_source uuid;
  v_pipeline uuid;
  v_stage uuid;
  v_inbound boolean := p_sender = 'contact';
begin
  select * into v_number from public.whatsapp_phone_numbers where phone_number_id = p_phone_number_id;
  if v_number.id is null then
    return jsonb_build_object('status', 'unknown_number');
  end if;

  select id into v_contact from public.contacts
  where tenant_id = v_number.tenant_id and phone_e164 = p_from_e164 and deleted_at is null;
  if v_contact is null then
    insert into public.contacts (tenant_id, full_name, phone_e164, provenance)
    values (v_number.tenant_id, coalesce(nullif(left(btrim(p_profile_name), 160), ''), p_from_e164), p_from_e164,
            jsonb_build_object('whatsapp_inbound', jsonb_build_object('phone_number_id', p_phone_number_id, 'at', now())))
    returning id into v_contact;

    -- Contato novo vira lead na primeira etapa, origem WhatsApp (entrada).
    select id into v_source from public.lead_sources where tenant_id = v_number.tenant_id and kind = 'whatsapp_inbound' and active limit 1;
    select p.id, s.id into v_pipeline, v_stage from public.pipelines p
    join public.pipeline_stages s on s.pipeline_id = p.id
    where p.tenant_id = v_number.tenant_id and p.is_default order by s.position limit 1;
    if v_pipeline is not null and v_inbound then
      insert into public.leads (tenant_id, contact_id, lead_source_id, pipeline_id, stage_id)
      values (v_number.tenant_id, v_contact, v_source, v_pipeline, v_stage);
    end if;
  end if;

  select * into v_conversation from public.conversations
  where tenant_id = v_number.tenant_id and contact_id = v_contact and phone_number_id = v_number.id and status <> 'closed'
  for update;
  if v_conversation.id is null then
    insert into public.conversations (tenant_id, contact_id, phone_number_id)
    values (v_number.tenant_id, v_contact, v_number.id) returning * into v_conversation;
  end if;

  insert into public.messages (tenant_id, conversation_id, phone_number_id, direction, sender_type, type, body, media, wa_message_id, status, occurred_at)
  values (v_number.tenant_id, v_conversation.id, v_number.id,
          case when v_inbound then 'inbound' else 'outbound' end::public.message_direction, p_sender,
          coalesce(p_type, 'text'), left(p_body, 4096), p_media, p_wa_message_id,
          case when v_inbound then 'received' else 'sent' end::public.message_status, coalesce(p_occurred_at, now()))
  on conflict (phone_number_id, wa_message_id) where wa_message_id is not null do nothing
  returning id into v_message;

  if v_message is null then
    return jsonb_build_object('status', 'duplicate', 'tenant_id', v_number.tenant_id, 'conversation_id', v_conversation.id, 'contact_id', v_contact);
  end if;

  update public.conversations set
    last_inbound_at = case when v_inbound then greatest(coalesce(last_inbound_at, p_occurred_at), p_occurred_at) else last_inbound_at end,
    last_message_at = greatest(last_message_at, coalesce(p_occurred_at, now())),
    last_message_preview = left(coalesce(p_body, '[' || coalesce(p_type, 'mídia') || ']'), 140),
    unread_count = unread_count + case when v_inbound then 1 else 0 end,
    status = case when status = 'closed' then 'open'::public.conversation_status else status end
  where id = v_conversation.id;

  return jsonb_build_object('status', 'created', 'tenant_id', v_number.tenant_id, 'conversation_id', v_conversation.id,
                            'contact_id', v_contact, 'message_id', v_message);
end;
$$;

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
  v_conversation public.conversations;
  v_template public.whatsapp_templates;
  v_suppressed_at timestamptz;
  v_checks jsonb := '{}';
  v_allowed boolean := true;
  v_in_window boolean;
  v_recent integer;
  v_row public.message_send_requests;
begin
  if not (private.is_service_role() or private.has_org_role(p_tenant, 'sales')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Idempotência: o mesmo pedido devolve a mesma decisão.
  select * into v_existing from public.message_send_requests where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return v_existing;
  end if;

  select * into v_contact from public.contacts where id = p_contact and tenant_id = p_tenant and deleted_at is null;
  select * into v_number from public.whatsapp_phone_numbers where id = p_phone_number and tenant_id = p_tenant;
  if v_contact.id is null or v_number.id is null then
    raise exception 'invalid_target' using errcode = 'P0002';
  end if;
  select * into v_conversation from public.conversations
  where tenant_id = p_tenant and contact_id = p_contact and phone_number_id = p_phone_number and status <> 'closed';

  -- 1. Empresa e número ativos.
  v_checks := v_checks || jsonb_build_object('organization_active', jsonb_build_object('ok',
    exists (select 1 from public.organizations where id = p_tenant and status = 'active')));
  v_checks := v_checks || jsonb_build_object('number_active', jsonb_build_object('ok', v_number.status = 'active', 'status', v_number.status));
  v_checks := v_checks || jsonb_build_object('has_phone', jsonb_build_object('ok', v_contact.phone_e164 is not null));

  -- 2. Supressão: vale até o contato voltar a escrever depois do descadastro.
  select created_at into v_suppressed_at from public.suppression_list
  where tenant_id = p_tenant and channel = 'whatsapp' and identifier = v_contact.phone_e164;
  v_checks := v_checks || jsonb_build_object('suppression', jsonb_build_object('ok',
    v_suppressed_at is null or (p_kind = 'free_text' and v_conversation.last_inbound_at > v_suppressed_at),
    'suppressed_at', v_suppressed_at));

  -- 3. Janela de 24 h para mensagem livre.
  v_in_window := v_conversation.last_inbound_at is not null and v_conversation.last_inbound_at > now() - interval '24 hours';
  if p_kind = 'free_text' then
    v_checks := v_checks || jsonb_build_object('service_window', jsonb_build_object('ok', v_in_window, 'last_inbound_at', v_conversation.last_inbound_at));
    v_checks := v_checks || jsonb_build_object('body', jsonb_build_object('ok', p_body is not null and char_length(btrim(p_body)) between 1 and 4096));
  else
    -- 4. Template aprovado, da mesma conta do número.
    select * into v_template from public.whatsapp_templates where id = p_template and tenant_id = p_tenant and account_id = v_number.account_id;
    v_checks := v_checks || jsonb_build_object('template_approved', jsonb_build_object('ok', v_template.id is not null and upper(v_template.status) = 'APPROVED'));
    -- 5. Consentimento vigente e finalidade compatível com a categoria.
    v_checks := v_checks || jsonb_build_object('consent', jsonb_build_object('ok', exists (
      select 1 from public.current_consents cc
      where cc.tenant_id = p_tenant and cc.contact_id = p_contact and cc.channel = 'whatsapp' and cc.is_valid
        and (case when v_template.category = 'marketing' then cc.purpose = 'marketing'
                  else cc.purpose = coalesce(p_purpose, cc.purpose) end)
    ), 'purpose', coalesce(p_purpose, case when v_template.category = 'marketing' then 'marketing'::public.consent_purpose end)));
    -- 6. Frequência: no máximo 2 mensagens proativas por contato em 7 dias.
    select count(*) into v_recent from public.message_send_requests
    where tenant_id = p_tenant and contact_id = p_contact and kind = 'template' and decision = 'allowed' and created_at > now() - interval '7 days';
    v_checks := v_checks || jsonb_build_object('frequency', jsonb_build_object('ok', v_recent < 2, 'last_7_days', v_recent));
  end if;

  -- 7. Campanha (quando houver) não pausada nem cancelada.
  v_checks := v_checks || jsonb_build_object('campaign_active', jsonb_build_object('ok', p_campaign_active));

  select bool_and((value ->> 'ok')::boolean) into v_allowed from jsonb_each(v_checks);

  insert into public.message_send_requests (
    tenant_id, contact_id, conversation_id, phone_number_id, origin, kind, purpose, template_id, body,
    idempotency_key, decision, checks, status, created_by, finished_at
  ) values (
    p_tenant, p_contact, v_conversation.id, p_phone_number, p_origin, p_kind, p_purpose, p_template, p_body,
    p_idempotency_key, case when v_allowed then 'allowed' else 'blocked' end::public.send_decision, v_checks,
    case when v_allowed then 'pending' else 'blocked' end, (select auth.uid()), case when v_allowed then null else now() end
  ) returning * into v_row;
  return v_row;
end;
$$;
