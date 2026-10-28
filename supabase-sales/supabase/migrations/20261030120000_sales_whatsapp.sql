-- PeriniHub AI Sales — Fase 3: WhatsApp oficial (Cloud API) e inbox.
--
-- Regras centrais:
-- * webhook duplicado não cria mensagem duplicada (chaves únicas);
-- * status de entrega só avança (sent < delivered < read; failed é final);
-- * todo envio iniciado pela empresa passa por whatsapp_send_gate, que
--   registra a decisão e o resultado de cada verificação;
-- * token de acesso da Meta fica no Supabase Vault, legível só pelo servidor.

create extension if not exists supabase_vault with schema vault;

create type public.whatsapp_provider as enum ('meta_cloud', 'sandbox');
create type public.whatsapp_status as enum ('pending', 'syncing', 'active', 'disconnected', 'error');
create type public.conversation_status as enum ('open', 'pending_human', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('contact', 'user', 'agent', 'system', 'business_app');
create type public.message_status as enum ('received', 'queued', 'sent', 'delivered', 'read', 'failed');
create type public.send_kind as enum ('free_text', 'template');
create type public.send_origin as enum ('user', 'agent', 'campaign', 'followup', 'system');
create type public.send_decision as enum ('allowed', 'blocked');
create type public.template_category as enum ('marketing', 'utility', 'authentication');

-- ---------------------------------------------------------------------------
-- Contas, números e templates
-- ---------------------------------------------------------------------------

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  provider public.whatsapp_provider not null,
  waba_id text check (waba_id is null or waba_id ~ '^[0-9]{5,30}$'),
  display_name text check (display_name is null or char_length(display_name) <= 120),
  status public.whatsapp_status not null default 'pending',
  coexistence boolean not null default false,
  -- Referência ao segredo no Vault; nunca o token.
  access_token_secret_id uuid,
  token_last4 text check (token_last4 is null or char_length(token_last4) = 4),
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
-- Uma WABA não pode estar em duas empresas.
create unique index whatsapp_accounts_waba_key on public.whatsapp_accounts (waba_id) where waba_id is not null;

create table public.whatsapp_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null,
  -- Id do número na Meta (ou "sandbox-..." no modo simulado). Único global:
  -- é por ele que o webhook descobre a empresa.
  phone_number_id text not null unique check (phone_number_id ~ '^([0-9]{5,30}|sandbox-[a-z0-9-]{4,40})$'),
  display_phone text not null check (char_length(display_phone) <= 30),
  verified_name text check (verified_name is null or char_length(verified_name) <= 120),
  quality_rating text,
  messaging_limit_tier text,
  status public.whatsapp_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, account_id) references public.whatsapp_accounts (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null,
  name text not null check (name ~ '^[a-z0-9_]{1,512}$'),
  language text not null check (char_length(language) between 2 and 10),
  category public.template_category not null,
  status text not null,
  components jsonb not null default '[]',
  meta_template_id text,
  synced_at timestamptz not null default now(),
  foreign key (tenant_id, account_id) references public.whatsapp_accounts (tenant_id, id) on delete cascade,
  unique (account_id, name, language),
  unique (tenant_id, id)
);

-- ---------------------------------------------------------------------------
-- Conversas e mensagens
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  phone_number_id uuid not null,
  status public.conversation_status not null default 'open',
  assigned_user_id uuid,
  handled_by text not null default 'human' check (handled_by in ('human', 'agent')),
  -- Base da janela de atendimento de 24 h: última mensagem recebida do contato.
  last_inbound_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_message_preview text check (last_message_preview is null or char_length(last_message_preview) <= 140),
  unread_count integer not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, assigned_user_id) references public.organization_members (tenant_id, user_id) on delete set null (assigned_user_id),
  unique (tenant_id, id)
);
-- Uma conversa ativa por contato e número.
create unique index conversations_active_key on public.conversations (tenant_id, contact_id, phone_number_id) where status <> 'closed';
create index conversations_inbox_idx on public.conversations (tenant_id, status, last_message_at desc);
create index conversations_assigned_idx on public.conversations (tenant_id, assigned_user_id, last_message_at desc);

create table public.message_send_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  conversation_id uuid,
  phone_number_id uuid not null,
  origin public.send_origin not null,
  kind public.send_kind not null,
  purpose public.consent_purpose,
  template_id uuid,
  body text check (body is null or char_length(body) <= 4096),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  decision public.send_decision not null,
  -- Resultado de cada verificação: {"suppression": {"ok": true}, ...}
  checks jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'blocked', 'canceled')),
  wa_message_id text,
  error text check (error is null or char_length(error) <= 1000),
  attempts integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (tenant_id, contact_id) references public.contacts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, conversation_id) references public.conversations (tenant_id, id) on delete set null (conversation_id),
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, template_id) references public.whatsapp_templates (tenant_id, id) on delete set null (template_id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);
create index message_send_requests_contact_idx on public.message_send_requests (tenant_id, contact_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  phone_number_id uuid not null,
  direction public.message_direction not null,
  sender_type public.message_sender not null,
  sender_user_id uuid references auth.users (id) on delete set null,
  type text not null default 'text' check (char_length(type) <= 30),
  body text check (body is null or char_length(body) <= 4096),
  template_name text,
  media jsonb,
  wa_message_id text,
  status public.message_status not null,
  error jsonb,
  send_request_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, conversation_id) references public.conversations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, phone_number_id) references public.whatsapp_phone_numbers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, send_request_id) references public.message_send_requests (tenant_id, id) on delete set null (send_request_id),
  unique (tenant_id, id)
);
-- Webhook repetido não duplica: o id da Meta é único por número.
create unique index messages_wa_id_key on public.messages (phone_number_id, wa_message_id) where wa_message_id is not null;
create index messages_conversation_idx on public.messages (tenant_id, conversation_id, occurred_at);

create table public.message_delivery_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (id) on delete cascade,
  wa_message_id text not null,
  status public.message_status not null,
  occurred_at timestamptz not null,
  pricing jsonb,
  errors jsonb,
  created_at timestamptz not null default now(),
  unique (wa_message_id, status)
);

-- Eventos brutos do webhook (sem empresa quando o número é desconhecido).
-- Só o servidor lê e grava; retenção curta (Fase 8).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'whatsapp',
  dedupe_key text not null unique check (char_length(dedupe_key) between 8 and 300),
  tenant_id uuid references public.organizations (id) on delete set null,
  phone_number_id text,
  kind text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'ignored', 'failed', 'dead_letter')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index webhook_events_pending_idx on public.webhook_events (status, received_at) where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger whatsapp_accounts_updated_at before update on public.whatsapp_accounts for each row execute function private.set_updated_at();
create trigger whatsapp_phone_numbers_updated_at before update on public.whatsapp_phone_numbers for each row execute function private.set_updated_at();
create trigger conversations_updated_at before update on public.conversations for each row execute function private.set_updated_at();
create trigger whatsapp_accounts_audit after insert or update or delete on public.whatsapp_accounts for each row execute function private.audit_change();
create trigger whatsapp_phone_numbers_audit after insert or update or delete on public.whatsapp_phone_numbers for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Token no Vault
-- ---------------------------------------------------------------------------

-- Admin grava o token de acesso da conta: vai para o Vault e a tabela guarda
-- só a referência e os 4 últimos caracteres.
create function public.whatsapp_set_access_token(p_tenant uuid, p_account uuid, p_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_account public.whatsapp_accounts;
  v_secret uuid;
begin
  if not (private.has_org_role(p_tenant, 'admin') or private.is_service_role()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 1000 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  select * into v_account from public.whatsapp_accounts where id = p_account and tenant_id = p_tenant for update;
  if v_account.id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if v_account.access_token_secret_id is null then
    v_secret := vault.create_secret(p_token, 'whatsapp_token_' || p_account::text, 'Token da conta WhatsApp ' || p_account::text);
  else
    perform vault.update_secret(v_account.access_token_secret_id, p_token);
    v_secret := v_account.access_token_secret_id;
  end if;
  update public.whatsapp_accounts set access_token_secret_id = v_secret, token_last4 = right(p_token, 4) where id = p_account;
end;
$$;

-- Leitura do token: só a secret key (servidor/worker), nunca usuários.
create function public.whatsapp_get_access_token(p_account uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select s.decrypted_secret
  from public.whatsapp_accounts a
  join vault.decrypted_secrets s on s.id = a.access_token_secret_id
  where a.id = p_account
$$;

-- ---------------------------------------------------------------------------
-- Gate de envio (docs/ai-sales/SECURITY.md §6)
-- ---------------------------------------------------------------------------

create function public.whatsapp_send_gate(
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
    p_idempotency_key, case when v_allowed then 'allowed' else 'blocked' end, v_checks,
    case when v_allowed then 'pending' else 'blocked' end, (select auth.uid()), case when v_allowed then null else now() end
  ) returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Processamento de eventos (só o servidor)
-- ---------------------------------------------------------------------------

-- Mensagem recebida: cria o contato se for novo (origem WhatsApp), abre ou
-- reaproveita a conversa e grava a mensagem uma única vez.
create function public.whatsapp_record_inbound(
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
          case when v_inbound then 'inbound' else 'outbound' end, p_sender,
          coalesce(p_type, 'text'), left(p_body, 4096), p_media, p_wa_message_id,
          case when v_inbound then 'received' else 'sent' end, coalesce(p_occurred_at, now()))
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
    status = case when status = 'closed' then 'open' else status end
  where id = v_conversation.id;

  return jsonb_build_object('status', 'created', 'tenant_id', v_number.tenant_id, 'conversation_id', v_conversation.id,
                            'contact_id', v_contact, 'message_id', v_message);
end;
$$;

-- Status de entrega: idempotente e só avança.
create function public.whatsapp_apply_status(p_wa_message_id text, p_status public.message_status, p_occurred_at timestamptz, p_pricing jsonb, p_errors jsonb)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_message public.messages;
  v_rank_new integer := case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end;
  v_rank_old integer;
begin
  select * into v_message from public.messages where wa_message_id = p_wa_message_id and direction = 'outbound' for update;
  if v_message.id is null then
    return 'unknown_message';
  end if;
  insert into public.message_delivery_events (tenant_id, wa_message_id, status, occurred_at, pricing, errors)
  values (v_message.tenant_id, p_wa_message_id, p_status, p_occurred_at, p_pricing, p_errors)
  on conflict (wa_message_id, status) do nothing;
  v_rank_old := case v_message.status when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end;
  if v_rank_new > v_rank_old and v_message.status <> 'failed' then
    update public.messages set status = p_status, error = coalesce(p_errors, error) where id = v_message.id;
    return 'updated';
  end if;
  return 'ignored';
end;
$$;

-- Descadastro pelo próprio contato ("SAIR"): supressão + revogação + cancela
-- envios pendentes, numa transação.
create function public.whatsapp_opt_out(p_tenant uuid, p_contact uuid, p_source text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text;
  v_purpose public.consent_purpose;
begin
  if not (private.is_service_role() or private.has_org_role(p_tenant, 'sales')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select phone_e164 into v_phone from public.contacts where id = p_contact and tenant_id = p_tenant;
  if v_phone is null then
    return;
  end if;
  insert into public.suppression_list (tenant_id, channel, identifier, reason, source)
  values (p_tenant, 'whatsapp', v_phone, 'opt_out', left(p_source, 200))
  on conflict (tenant_id, channel, identifier) do nothing;
  foreach v_purpose in array enum_range(null::public.consent_purpose) loop
    insert into public.consent_records (tenant_id, contact_id, channel, purpose, legal_basis, status, source, evidence)
    values (p_tenant, p_contact, 'whatsapp', v_purpose, 'consent', 'revoked', left(p_source, 200), jsonb_build_object('kind', 'whatsapp_message'));
  end loop;
  update public.message_send_requests set status = 'canceled', finished_at = now(), error = 'opt_out'
  where tenant_id = p_tenant and contact_id = p_contact and status = 'pending';
end;
$$;

-- Plano interno: libera um número e um volume mensal modesto de mensagens.
update public.subscription_plans
set entitlements = jsonb_set(jsonb_set(entitlements, '{limits,whatsapp_numbers}', '1'), '{limits,whatsapp_messages}', '1000')
where code = 'internal';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_phone_numbers enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_delivery_events enable row level security;
alter table public.message_send_requests enable row level security;
alter table public.webhook_events enable row level security;

revoke all on public.whatsapp_accounts, public.whatsapp_phone_numbers, public.whatsapp_templates, public.conversations,
  public.messages, public.message_delivery_events, public.message_send_requests, public.webhook_events from anon, authenticated;
grant all on public.whatsapp_accounts, public.whatsapp_phone_numbers, public.whatsapp_templates, public.conversations,
  public.messages, public.message_delivery_events, public.message_send_requests, public.webhook_events to service_role;

-- Conta: membros veem o estado (sem o segredo); admin gerencia metadados.
grant select (id, tenant_id, provider, waba_id, display_name, status, coexistence, token_last4, connected_by, connected_at, last_error, created_at, updated_at)
  on public.whatsapp_accounts to authenticated;
grant insert (tenant_id, provider, waba_id, display_name, status, coexistence, connected_by, connected_at) on public.whatsapp_accounts to authenticated;
grant update (display_name, status, last_error) on public.whatsapp_accounts to authenticated;
grant delete on public.whatsapp_accounts to authenticated;
create policy "membros veem contas" on public.whatsapp_accounts for select to authenticated using (private.is_member(tenant_id));
create policy "admin conecta contas" on public.whatsapp_accounts for insert to authenticated with check (private.has_org_role(tenant_id, 'admin'));
create policy "admin altera contas" on public.whatsapp_accounts for update to authenticated
  using (private.has_org_role(tenant_id, 'admin')) with check (private.has_org_role(tenant_id, 'admin'));
create policy "admin remove contas" on public.whatsapp_accounts for delete to authenticated using (private.has_org_role(tenant_id, 'admin'));

grant select on public.whatsapp_phone_numbers, public.whatsapp_templates to authenticated;
grant insert, update, delete on public.whatsapp_phone_numbers to authenticated;
create policy "membros veem números" on public.whatsapp_phone_numbers for select to authenticated using (private.is_member(tenant_id));
create policy "admin gerencia números" on public.whatsapp_phone_numbers for all to authenticated
  using (private.has_org_role(tenant_id, 'admin')) with check (private.has_org_role(tenant_id, 'admin'));
create policy "membros veem templates" on public.whatsapp_templates for select to authenticated using (private.is_member(tenant_id));

-- Conversas e mensagens: vendedor ou acima (viewer só se a empresa permitir).
create function private.can_read_conversations(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_org_role(p_tenant, 'sales')
    or (private.is_member(p_tenant)
        and coalesce((select viewer_can_read_conversations from public.organization_settings where tenant_id = p_tenant), false))
$$;
grant execute on function private.can_read_conversations(uuid) to authenticated, service_role;

grant select on public.conversations, public.messages, public.message_delivery_events, public.message_send_requests to authenticated;
grant update (status, assigned_user_id, handled_by, unread_count) on public.conversations to authenticated;
create policy "conversas visíveis" on public.conversations for select to authenticated using (private.can_read_conversations(tenant_id));
create policy "vendedor atende conversas" on public.conversations for update to authenticated
  using (private.has_org_role(tenant_id, 'sales')) with check (private.has_org_role(tenant_id, 'sales'));
create policy "mensagens visíveis" on public.messages for select to authenticated using (private.can_read_conversations(tenant_id));
create policy "status visíveis" on public.message_delivery_events for select to authenticated using (private.can_read_conversations(tenant_id));
create policy "decisões de envio visíveis" on public.message_send_requests for select to authenticated using (private.has_org_role(tenant_id, 'sales'));
-- webhook_events: sem policy (só service_role).

grant execute on function public.whatsapp_set_access_token(uuid, uuid, text),
  public.whatsapp_send_gate(uuid, uuid, uuid, public.send_kind, public.send_origin, text, text, uuid, public.consent_purpose, boolean),
  public.whatsapp_opt_out(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.whatsapp_get_access_token(uuid),
  public.whatsapp_record_inbound(text, text, text, text, text, text, jsonb, timestamptz, public.message_sender),
  public.whatsapp_apply_status(text, public.message_status, timestamptz, jsonb, jsonb)
  to service_role;
