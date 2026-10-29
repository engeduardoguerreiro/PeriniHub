-- PeriniHub AI Sales — Fase 8: correções da revisão de segurança.
--
-- 1 (alto) gate de envio: a mesma chave de idempotência com outro destino ou
--   conteúdo é recusada; o envio é reivindicado de forma atômica (sending).
-- 2 catálogo de modelos de IA da plataforma: o preço vem dele, não do tenant.
-- 3/8 autoria (created_by, resolved_by) preenchida pelo banco, nunca pelo cliente.
-- 4 formulário público não troca telefone/e-mail de contato existente e só
--   registra consentimento no identificador que o titular informou.
-- 6 enriquecimento só pelo servidor (dados não podem ser forjados pelo cliente).
-- 9 leitor (viewer) segue a mesma visibilidade de leads do vendedor.

-- ---------------------------------------------------------------------------
-- 1. Gate de envio
-- ---------------------------------------------------------------------------

alter table public.message_send_requests drop constraint message_send_requests_status_check;
alter table public.message_send_requests add constraint message_send_requests_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'blocked', 'canceled'));

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
    -- Mesma chave com outro destino ou conteúdo: recusa (a linha aprovada
    -- nunca serve de passe para um envio diferente).
    if v_existing.contact_id is distinct from p_contact or v_existing.phone_number_id is distinct from p_phone_number
       or v_existing.kind is distinct from p_kind or v_existing.body is distinct from p_body
       or v_existing.template_id is distinct from p_template or v_existing.origin is distinct from p_origin then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
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

-- ---------------------------------------------------------------------------
-- 2. Catálogo de modelos (preço por milhão de tokens, US$)
-- ---------------------------------------------------------------------------

create table public.ai_model_catalog (
  provider text not null check (provider in ('anthropic', 'mock')),
  model text not null check (model ~ '^[a-z0-9.-]{2,80}$'),
  input_price_per_mtok numeric(10, 4) not null check (input_price_per_mtok >= 0),
  output_price_per_mtok numeric(10, 4) not null check (output_price_per_mtok >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (provider, model),
  -- Modelo pago nunca com preço zero (o teto de IA dependeria disso).
  check (provider = 'mock' or (input_price_per_mtok > 0 and output_price_per_mtok > 0))
);
insert into public.ai_model_catalog (provider, model, input_price_per_mtok, output_price_per_mtok) values
  ('mock', 'mock', 0, 0),
  ('anthropic', 'claude-sonnet-5-5', 2, 10),
  ('anthropic', 'claude-haiku-5-5', 0.1, 0.5);
create trigger ai_model_catalog_audit after insert or update or delete on public.ai_model_catalog for each row execute function private.audit_change();
alter table public.ai_model_catalog enable row level security;
revoke all on public.ai_model_catalog from anon, authenticated;
grant select on public.ai_model_catalog to authenticated;
grant all on public.ai_model_catalog to service_role;
create policy "catálogo visível" on public.ai_model_catalog for select to authenticated using (active);

-- Versões existentes passam a usar o preço do catálogo.
update public.agent_versions v
set input_price_per_mtok = c.input_price_per_mtok, output_price_per_mtok = c.output_price_per_mtok
from public.ai_model_catalog c
where c.provider = v.provider and c.model = v.model;

-- Mesma assinatura; os preços enviados são ignorados.
create or replace function public.create_agent_version(
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
  v_model public.ai_model_catalog;
  v_row public.agent_versions;
begin
  if not (private.has_org_role(p_tenant, 'admin') or private.is_service_role()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ai_agents where id = p_agent and tenant_id = p_tenant) then
    raise exception 'agent_not_found' using errcode = 'P0002';
  end if;
  -- Simulado: qualquer nome de modelo, custo zero. Pago: só o catálogo.
  if p_provider = 'mock' then
    v_model := row('mock', p_model, 0, 0, true, now())::public.ai_model_catalog;
  else
    select * into v_model from public.ai_model_catalog where provider = p_provider and model = p_model and active;
  end if;
  if v_model.model is null then
    raise exception 'model_not_allowed' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_knowledge_base_ids, '{}')) kb
             where not exists (select 1 from public.knowledge_bases b where b.id = kb and b.tenant_id = p_tenant)) then
    raise exception 'invalid_knowledge_base' using errcode = '23503';
  end if;
  perform 1 from public.ai_agents where id = p_agent for update;
  select coalesce(max(version), 0) + 1 into v_next from public.agent_versions where agent_id = p_agent;
  insert into public.agent_versions (tenant_id, agent_id, version, system_prompt, provider, model, max_output_tokens,
                                     input_price_per_mtok, output_price_per_mtok, knowledge_base_ids, notes, created_by)
  values (p_tenant, p_agent, v_next, p_system_prompt, p_provider, p_model, p_max_output_tokens,
          v_model.input_price_per_mtok, v_model.output_price_per_mtok, coalesce(p_knowledge_base_ids, '{}'), p_notes, (select auth.uid()))
  returning * into v_row;
  update public.ai_agents set current_version_id = v_row.id where id = p_agent;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 e 8. Autoria pelo banco
-- ---------------------------------------------------------------------------

create trigger campaigns_actor before insert on public.campaigns for each row execute function private.stamp_actor();
create trigger ai_agents_actor before insert on public.ai_agents for each row execute function private.stamp_actor();
create trigger followup_rules_actor before insert on public.followup_rules for each row execute function private.stamp_actor();

revoke insert on public.campaigns from authenticated;
grant insert (tenant_id, name, objective, purpose, phone_number_id, template_id, template_parameters, audience_filter, starts_at,
              window_start, window_end, hourly_limit, daily_limit, total_limit) on public.campaigns to authenticated;
revoke insert on public.ai_agents from authenticated;
grant insert (tenant_id, type, name, objective, status, phone_number_id, auto_take_new_conversations, handoff_confidence,
              max_replies_per_conversation, daily_executions_limit) on public.ai_agents to authenticated;

-- Quem resolve a transferência é quem está logado.
create function private.stamp_handoff_resolver()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.resolved_by := case when new.status = 'resolved' then (select auth.uid()) end;
    new.resolved_at := case when new.status = 'resolved' then coalesce(old.resolved_at, now()) end;
  end if;
  return new;
end;
$$;
create trigger agent_handoffs_resolver before update on public.agent_handoffs for each row execute function private.stamp_handoff_resolver();

-- ---------------------------------------------------------------------------
-- 4. Formulário público
-- ---------------------------------------------------------------------------

create or replace function public.capture_form_submit(
  p_public_key text,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_company text,
  p_job_title text,
  p_message text,
  p_consent boolean,
  p_consent_version integer,
  p_payload_hash text,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_form public.capture_forms;
  v_version public.capture_form_consent_versions;
  v_now timestamptz := now();
  v_origin jsonb;
  v_contact public.contacts;
  v_company uuid;
  v_source uuid;
  v_pipeline uuid;
  v_stage uuid;
  v_lead uuid;
  v_submission uuid;
  v_channel public.consent_channel;
  v_purpose public.consent_purpose;
  v_identifier text;
  v_provenance jsonb := '{}';
  v_received text[] := '{}';
  v_review text;
begin
  select f.* into v_form
  from public.capture_forms f join public.organizations o on o.id = f.tenant_id
  where f.public_key = p_public_key and f.status = 'active' and o.status = 'active';
  if v_form.id is null then
    raise exception 'form_unavailable' using errcode = 'P0002';
  end if;
  -- O titular precisa ter visto o texto vigente.
  if p_consent_version is distinct from v_form.consent_version then
    raise exception 'consent_version_changed' using errcode = '22023';
  end if;
  if nullif(btrim(p_full_name), '') is null then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if p_phone_e164 is null and p_email is null then
    raise exception 'contact_required' using errcode = '22023';
  end if;
  select * into v_version from public.capture_form_consent_versions
  where tenant_id = v_form.tenant_id and form_id = v_form.id and version = v_form.consent_version;

  v_origin := jsonb_build_object('source', 'form', 'form_id', v_form.id, 'at', v_now);

  insert into public.form_submissions (tenant_id, form_id, consent_given, consent_version, payload_hash, ip_hash, user_agent)
  values (v_form.tenant_id, v_form.id, coalesce(p_consent, false), v_form.consent_version, p_payload_hash, p_ip_hash, left(p_user_agent, 300))
  returning id into v_submission;
  v_origin := v_origin || jsonb_build_object('submission_id', v_submission);

  -- Empresa informada pelo próprio titular.
  if nullif(btrim(p_company), '') is not null then
    select id into v_company from public.companies
    where tenant_id = v_form.tenant_id and lower(name) = lower(btrim(p_company)) and deleted_at is null limit 1;
    if v_company is null then
      insert into public.companies (tenant_id, name, provenance)
      values (v_form.tenant_id, btrim(p_company), jsonb_build_object('name', v_origin))
      returning id into v_company;
    end if;
  end if;

  select * into v_contact from public.contacts
  where tenant_id = v_form.tenant_id and deleted_at is null
    and ((p_phone_e164 is not null and phone_e164 = p_phone_e164)
      or (p_email is not null and email_normalized = lower(btrim(p_email))))
  order by (phone_e164 is not distinct from p_phone_e164) desc, created_at
  limit 1;

  if v_contact.id is null then
    if p_phone_e164 is not null then v_provenance := v_provenance || jsonb_build_object('phone_e164', v_origin); end if;
    if p_email is not null then v_provenance := v_provenance || jsonb_build_object('email', v_origin); end if;
    if p_job_title is not null then v_provenance := v_provenance || jsonb_build_object('job_title', v_origin); end if;
    if v_company is not null then v_provenance := v_provenance || jsonb_build_object('company_id', v_origin); end if;
    insert into public.contacts (tenant_id, full_name, phone_e164, email, company_id, job_title, provenance)
    values (v_form.tenant_id, btrim(p_full_name), p_phone_e164, p_email, v_company, p_job_title,
            v_provenance || jsonb_build_object('full_name', v_origin))
    returning * into v_contact;
  else
    -- Contato existente: envio público não troca nem completa telefone ou
    -- e-mail (quem conhece o e-mail de um cliente não pode pôr o próprio
    -- número no contato dele). Identificador novo vira nota para revisão.
    if v_contact.job_title is null and p_job_title is not null then v_provenance := v_provenance || jsonb_build_object('job_title', v_origin); end if;
    if v_contact.company_id is null and v_company is not null then v_provenance := v_provenance || jsonb_build_object('company_id', v_origin); end if;
    update public.contacts set
      job_title = coalesce(job_title, p_job_title),
      company_id = coalesce(company_id, v_company),
      provenance = provenance || v_provenance
    where id = v_contact.id
    returning * into v_contact;
    if (p_phone_e164 is not null and v_contact.phone_e164 is distinct from p_phone_e164)
       or (p_email is not null and v_contact.email_normalized is distinct from lower(btrim(p_email))) then
      v_review := format('Envio informou dados de contato diferentes do cadastro (telefone: %s; e-mail: %s). Confirme com o titular antes de atualizar.',
                         coalesce(p_phone_e164, '—'), coalesce(p_email, '—'));
    end if;
  end if;

  -- Consentimento: um registro por canal × finalidade, só onde há identificador.
  if coalesce(p_consent, false) then
    foreach v_channel in array v_form.consent_channels loop
      -- Só no identificador que o próprio titular informou e que está no contato.
      v_identifier := case when v_channel = 'email' then
                        case when v_contact.email_normalized = lower(btrim(p_email)) then v_contact.email end
                      else
                        case when v_contact.phone_e164 = p_phone_e164 then v_contact.phone_e164 end
                      end;
      continue when v_identifier is null;
      foreach v_purpose in array v_form.consent_purposes loop
        insert into public.consent_records (tenant_id, contact_id, channel, purpose, legal_basis, status, source, evidence)
        values (v_form.tenant_id, v_contact.id, v_channel, v_purpose, 'consent', 'granted', left('Formulário: ' || v_form.name, 200),
                jsonb_build_object('kind', 'form_submission', 'submission_id', v_submission, 'form_id', v_form.id,
                                   'text_version', v_form.consent_version, 'text_hash', v_version.text_hash,
                                   'payload_hash', p_payload_hash, 'ip_hash', p_ip_hash, 'captured_at', v_now));
      end loop;
    end loop;
  end if;

  -- Lead: reaproveita um aberto; senão cria na primeira etapa do pipeline padrão.
  select l.id into v_lead from public.leads l
  join public.pipeline_stages s on s.id = l.stage_id
  where l.tenant_id = v_form.tenant_id and l.contact_id = v_contact.id and l.deleted_at is null and not s.is_won and not s.is_lost
  order by l.created_at desc limit 1;

  if v_lead is null then
    v_source := v_form.lead_source_id;
    if v_source is null then
      select id into v_source from public.lead_sources
      where tenant_id = v_form.tenant_id and kind = 'form' and active order by created_at limit 1;
    end if;
    select p.id, s.id into v_pipeline, v_stage
    from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
    where p.tenant_id = v_form.tenant_id and p.is_default
    order by s.position limit 1;
    if v_pipeline is not null then
      insert into public.leads (tenant_id, contact_id, company_id, lead_source_id, pipeline_id, stage_id, title)
      values (v_form.tenant_id, v_contact.id, coalesce(v_contact.company_id, v_company), v_source, v_pipeline, v_stage, left('Formulário: ' || v_form.name, 160))
      returning id into v_lead;
    end if;
  end if;

  if p_phone_e164 is not null then v_received := array_append(v_received, 'phone'); end if;
  if p_email is not null then v_received := array_append(v_received, 'email'); end if;
  if p_company is not null then v_received := array_append(v_received, 'company'); end if;
  if p_job_title is not null then v_received := array_append(v_received, 'job_title'); end if;
  if p_message is not null then v_received := array_append(v_received, 'message'); end if;

  insert into public.activities (tenant_id, lead_id, contact_id, kind, body, metadata, actor_type)
  values (v_form.tenant_id, v_lead, v_contact.id, 'system',
          left(format('Formulário "%s" enviado%s.%s%s', v_form.name,
                      case when coalesce(p_consent, false) then ' com consentimento' else ' sem consentimento' end,
                      case when v_review is not null then E'\n\n' || v_review else '' end,
                      case when p_message is not null then E'\n\nMensagem: ' || p_message else '' end), 4000),
          jsonb_build_object('form_id', v_form.id, 'submission_id', v_submission), 'system');

  update public.form_submissions set contact_id = v_contact.id, lead_id = v_lead, fields_received = v_received
  where id = v_submission;
  update public.capture_forms set submissions_count = submissions_count + 1 where id = v_form.id;

  return jsonb_build_object('submission_id', v_submission, 'tenant_id', v_form.tenant_id, 'contact_id', v_contact.id, 'lead_id', v_lead);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Enriquecimento só pelo servidor
-- ---------------------------------------------------------------------------

drop function public.company_apply_enrichment(uuid, uuid, text, public.enrichment_status, jsonb);
revoke insert, update on public.company_enrichments from authenticated;
drop policy "vendedor enriquece" on public.company_enrichments;
drop policy "vendedor marca campos aplicados" on public.company_enrichments;

create function public.company_apply_enrichment(p_actor uuid, p_tenant uuid, p_company uuid, p_document text, p_status public.enrichment_status, p_data jsonb)
returns public.company_enrichments
language plpgsql security definer set search_path = ''
as $$
declare
  v_company public.companies;
  v_applied text[] := '{}';
  v_origin jsonb;
  v_provenance jsonb := '{}';
  v_row public.company_enrichments;
begin
  -- Chamada só pelo servidor, depois de findMembership; confere de novo o autor.
  if not exists (
    select 1 from public.organization_members m join public.organizations o on o.id = m.tenant_id
    where m.tenant_id = p_tenant and m.user_id = p_actor and m.status = 'active' and m.role >= 'sales' and o.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_company from public.companies where tenant_id = p_tenant and id = p_company and deleted_at is null;
  if v_company.id is null then
    raise exception 'company_not_found' using errcode = 'P0002';
  end if;
  if v_company.document is not null and v_company.document <> p_document then
    raise exception 'document_mismatch' using errcode = '22023';
  end if;

  insert into public.company_enrichments (tenant_id, company_id, source, document, status, data, fetched_by)
  values (p_tenant, p_company, 'brasilapi_cnpj', p_document, p_status, coalesce(p_data, '{}'), p_actor)
  returning * into v_row;

  if p_status <> 'success' then
    return v_row;
  end if;

  v_origin := jsonb_build_object('source', 'brasilapi_cnpj', 'enrichment_id', v_row.id, 'at', v_row.fetched_at);
  if v_company.document is null then v_applied := array_append(v_applied, 'document'); end if;
  if v_company.trade_name is null and nullif(p_data ->> 'trade_name', '') is not null then v_applied := array_append(v_applied, 'trade_name'); end if;
  if v_company.cnae is null and p_data ->> 'cnae' ~ '^[0-9]{7}$' then v_applied := array_append(v_applied, 'cnae'); end if;
  if v_company.city is null and nullif(p_data ->> 'city', '') is not null then v_applied := array_append(v_applied, 'city'); end if;
  if v_company.state is null and p_data ->> 'state' ~ '^[A-Z]{2}$' then v_applied := array_append(v_applied, 'state'); end if;
  if v_company.size is null and nullif(p_data ->> 'size', '') is not null then v_applied := array_append(v_applied, 'size'); end if;
  if v_company.opened_on is null and p_data ->> 'opened_on' ~ '^\d{4}-\d{2}-\d{2}$' then v_applied := array_append(v_applied, 'opened_on'); end if;
  if nullif(p_data ->> 'registration_status', '') is not null then v_applied := array_append(v_applied, 'registration_status'); end if;

  select coalesce(jsonb_object_agg(field, v_origin), '{}') into v_provenance from unnest(v_applied) field;

  update public.companies set
    document = coalesce(document, p_document),
    trade_name = case when 'trade_name' = any(v_applied) then left(p_data ->> 'trade_name', 200) else trade_name end,
    cnae = case when 'cnae' = any(v_applied) then p_data ->> 'cnae' else cnae end,
    city = case when 'city' = any(v_applied) then left(p_data ->> 'city', 80) else city end,
    state = case when 'state' = any(v_applied) then p_data ->> 'state' else state end,
    size = case when 'size' = any(v_applied) then left(p_data ->> 'size', 60) else size end,
    opened_on = case when 'opened_on' = any(v_applied) then (p_data ->> 'opened_on')::date else opened_on end,
    registration_status = case when 'registration_status' = any(v_applied) then left(p_data ->> 'registration_status', 40) else registration_status end,
    enriched_at = v_row.fetched_at,
    provenance = provenance || v_provenance
  where tenant_id = p_tenant and id = p_company;

  update public.company_enrichments set applied_fields = v_applied where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Leitor segue a visibilidade do vendedor
-- ---------------------------------------------------------------------------

create or replace function private.can_see_lead(p_tenant uuid, p_owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when private.org_role(p_tenant) is null then false
    when private.org_role(p_tenant) not in ('sales', 'viewer') then true
    when p_owner = (select auth.uid()) then true
    else coalesce((select s.sales_visibility = 'all' from public.organization_settings s where s.tenant_id = p_tenant), false)
  end
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke execute on function public.company_apply_enrichment(uuid, uuid, uuid, text, public.enrichment_status, jsonb) from public, anon, authenticated;
revoke execute on function private.stamp_handoff_resolver() from public, anon, authenticated;
revoke execute on function public.capture_form_submit(text, text, text, text, text, text, text, boolean, integer, text, text, text) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
