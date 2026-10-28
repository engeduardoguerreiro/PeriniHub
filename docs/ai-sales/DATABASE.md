# PeriniHub AI Sales — Banco de dados

> Status: **Fase 0 (proposta)**. Nenhuma migration do AI Sales foi criada ou
> aplicada. Onde o schema depende de decisão aberta, o item `D-xx` está
> indicado (ver [DECISIONS.md](./DECISIONS.md)).

## 1. Onde fica

Decidido em **D-01** (2026-10-28): projeto Supabase dedicado "AI Sales".

- **Projeto Supabase dedicado (escolhido)**: tabelas no schema `public` do
  novo projeto, migrations em `supabase-sales/migrations/` aplicadas com
  `supabase --workdir supabase-sales db push`. Um projeto de desenvolvimento
  agora; produção só na Fase 8.
- ~~Mesmo projeto do portal~~ (descartado): schema Postgres próprio `sales` (adicionado aos
  "Exposed schemas" da Data API), migrations em `supabase/migrations/` com
  prefixo `*_sales_*`. Nenhuma tabela `news_*` é tocada.



## 2. Convenções

- **Ids**: `uuid` com `default gen_random_uuid()`. Exceções: tabelas de
  referência globais com chave natural (ex.: `subscription_plans.code`).
- **Tenant**: coluna `tenant_id uuid not null references organizations(id)`
  em toda tabela de empresa. Toda tabela de tenant tem
  `unique (tenant_id, id)`; relações entre tabelas de tenant usam **FK
  composta** `(tenant_id, x_id) → x (tenant_id, id)` (ADR-005).
- **Tempo**: `timestamptz` (armazenado em UTC); `created_at`/`updated_at`
  com trigger `set_updated_at`. Datas de negócio exibidas no fuso da empresa.
- **Exclusão**: entidades de CRM têm `deleted_at` (soft delete, some das
  consultas e do RLS de leitura comum); a exclusão definitiva acontece por
  política de retenção ou por pedido do titular (anonimização) — ver §6.
  Tabelas de log (`audit_logs`, `webhook_events`, `message_delivery_events`,
  `agent_executions`) são append-only: `revoke update, delete` de
  `authenticated`.
- **Enums**: tipos Postgres para estados com transições controladas
  (`campaign_status`, `consent_status`...); listas configuráveis pelo usuário
  são tabelas (estágios, origens, tags).
- **Telefones** em E.164 (`+5511999998888`) normalizados no app
  (libphonenumber-js, D-09) e checados com `check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')`.
  E-mails: coluna `email_normalized` = `lower(trim(email))`.
- **Funções**: `security definer` só quando necessário, sempre com
  `set search_path = ''` e nomes qualificados; helpers de RLS em schema
  `private` (não exposto pela API).
- **Grants explícitos**: nada de `grant all` para `authenticated`; cada
  tabela recebe só as operações que alguma policy permite.

## 3. Funções de autorização (núcleo do RLS)

```sql
-- papel efetivo do usuário logado na empresa (null se não é membro ativo)
private.org_role(p_tenant uuid) returns public.org_role        -- security definer, stable
private.is_member(p_tenant uuid) returns boolean               -- org_role(...) is not null
private.has_org_role(p_tenant uuid, p_min public.org_role) returns boolean  -- hierarquia
private.is_platform_admin() returns boolean                    -- platform_admins + aal2
private.is_service_role() returns boolean                      -- já existe no portal (reusar a ideia)
```

Padrão de policy (exemplo `leads`):

```sql
create policy leads_select on leads for select to authenticated
  using (deleted_at is null and private.is_member(tenant_id)
         and (private.has_org_role(tenant_id, 'manager')
              or private.sales_can_see(tenant_id, owner_user_id)));
create policy leads_insert on leads for insert to authenticated
  with check (private.has_org_role(tenant_id, 'sales'));
-- update: sales só nos atribuídos; delete (soft): manager+
```

`(select auth.uid())` dentro das funções para o planner avaliar uma vez por
query; índice `organization_members (user_id, tenant_id) where status='active'`.

## 4. Entidades

Legenda: **G** = global (sem tenant), **T** = de empresa (tenant_id + RLS).

### 4.1 Plataforma — Fase 1

| Tabela | Tipo | Colunas principais / regras |
|---|---|---|
| `organizations` | G* | `id`, `slug` (único, `^[a-z0-9-]{3,48}$`), `name`, `legal_name`, `document` (CNPJ, opcional, único quando presente), `status` (`active`,`suspended`,`closed`), `created_by`. *Leitura só por membros; criação só por SUPERADMIN (servidor). |
| `organization_members` | T | `tenant_id`, `user_id → auth.users`, `role org_role`, `status` (`invited`,`active`,`disabled`), `invited_by`. `unique (tenant_id, user_id)`. Trigger impede remover/rebaixar o último OWNER. |
| `organization_invites` | T | `email_normalized`, `role`, `token_hash` (sha256), `expires_at`, `accepted_at`, `revoked_at`. Aceite via função que confere e-mail do usuário logado. |
| `organization_settings` | T | 1:1 com organização: `timezone`, `locale`, `sales_visibility` (`all`/`assigned`), `require_mfa`, `viewer_can_read_conversations`, `business_hours jsonb`, `quiet_hours`, limites operacionais próprios (≤ plano). |
| `platform_admins` | G | `user_id`, `granted_by`, `granted_at`. Sem policy para `authenticated` (lida só por função `security definer`). |
| `subscription_plans` | G | `code`, `name`, `entitlements jsonb` (limites: usuários, leads, agentes, números WhatsApp, US$ IA/mês, mensagens/mês), `is_public`, `active`. Valores iniciais = placeholders "interno" (sem preço fictício). |
| `subscriptions` | T | `plan_code`, `status` (`trial`,`active`,`past_due`,`canceled`,`internal`), `billing_mode` (`manual`,`gateway`), `current_period_start/end`, `limit_overrides jsonb`, `external_ref` (futuro gateway). |
| `usage_records` | T | `metric` (`ai_cost_usd`,`ai_tokens`,`wa_messages`,`leads`,...), `quantity numeric`, `period_month date`, `source_type`, `source_id`, `idempotency_key` único. Agregação mensal por view. |
| `usage_reservations` | T | Reserva antes de gastar (IA, envio): `metric`, `amount`, `status` (`reserved`,`settled`,`released`), `expires_at`. Função `reserve_usage(p_tenant, p_metric, p_amount, p_key)` com `for update` no contador do mês: recusa se `usado + reservado + pedido > limite`. |
| `audit_logs` | T/G | `tenant_id` nulo para ações de plataforma; `actor_type` (`user`,`agent`,`system`,`platform_admin`), `actor_id`, `action`, `entity_type`, `entity_id`, `diff jsonb` (sem conteúdo de mensagens), `reason` (obrigatório em break-glass), `ip_hash`, `created_at`. Append-only. |
| `rate_limits` | G | `bucket_key`, `window_start`, `count`. Função `consume_rate_limit(key, window_s, max)` (atômica). Limpeza periódica. |

### 4.2 CRM — Fase 2 (implementado)

> Implementado em `20261029120000_sales_crm.sql`. Diferenças: `imports`
> registra o resultado (arquivo não é guardado); `exports` virou registro em
> `audit_logs` (`record_export`); `leads` exige etapa do mesmo pipeline por FK
> `(tenant_id, pipeline_id, stage_id)` e responsável membro da empresa por FK
> para `organization_members`; `contacts.email_normalized` é coluna gerada.

| Tabela | Colunas principais / regras |
|---|---|
| `companies` | `name`, `document` (CNPJ normalizado), `cnae`, `city`, `state`, `size` (só se fonte confiável), `website`, `provenance jsonb`. `unique (tenant_id, document) where document is not null and deleted_at is null`. |
| `contacts` | `full_name`, `phone_e164`, `email`, `email_normalized`, `company_id` (FK composta), `job_title`, `provenance jsonb`, `whatsapp_wa_id`. Únicos parciais: `(tenant_id, phone_e164)` e `(tenant_id, email_normalized)` onde não nulos e não excluídos. |
| `lead_sources` | `code`, `name`, `kind` (`form`,`csv`,`manual`,`ads`,`api`,`research`,`whatsapp_inbound`). |
| `leads` | `contact_id`, `company_id`, `lead_source_id`, `owner_user_id`, `pipeline_id` + `stage_id` (FKs compostas; os estágios configuráveis são o "status" do lead e alimentam o Kanban), `qualification` (`unknown`,`cold`,`warm`,`hot`), `score smallint 0–100`, `score_reasons jsonb`, `discovery_stage` (`company_identified`,`contact_found`,`contact_authorized`,`qualified_opportunity` — §15 do briefing). **Situação de consentimento não fica aqui**: é derivada de `consent_records`. |
| `pipelines` | `name`, `is_default` (um por tenant, índice parcial único). |
| `pipeline_stages` | `pipeline_id` (FK composta), `name`, `position`, `is_qualified`, `is_won`, `is_lost`, `color`. Seed do pipeline sugerido (Novo → … → Ganho/Perdido) ao criar a empresa. |
| `opportunities` | Negócio com valor, criado a partir de um lead qualificado (um lead pode ter várias): `lead_id`, `pipeline_id`, `stage_id`, `title`, `amount_cents bigint`, `currency`, `expected_close_date`, `status` (`open`,`won`,`lost`), `lost_reason`, `owner_user_id`. Trigger garante que `stage_id` pertence ao `pipeline_id`. |
| `activities` | Linha do tempo: `subject_type` (`lead`,`contact`,`opportunity`), `subject_id`, `kind` (`note`,`stage_change`,`call`,`email`,`message`,`agent_action`,`consent_change`...), `body`, `metadata jsonb`, `actor_type/actor_id`. |
| `tasks` | `subject_type/id`, `title`, `due_at`, `assignee_user_id`, `status`, `remind_at`, `created_by_type` (user/agent). |
| `tags`, `contact_tags` | `tags (tenant_id, name)` único; `contact_tags (tenant_id, contact_id, tag_id)` PK composta. |
| `imports` | Importações CSV: `file_path` (Storage), `status`, `mapping jsonb`, `stats jsonb`, `errors_path`, `created_by`. Linhas processadas pelo worker em lotes. |
| `exports` | `requested_by`, `scope jsonb`, `status`, `file_path`, `expires_at`, `downloaded_at`. Só MANAGER+. Auditado. |

### 4.3 Consentimento e privacidade — Fase 2 (consentimento e supressão implementados)

> `consent_records` (com `evidence` em jsonb no próprio registro, em vez de
> tabela separada), view `current_consents` e `suppression_list` existem.
> `privacy_requests` e `data_retention_policies` ficam para a Fase 8.

| Tabela | Colunas principais / regras |
|---|---|
| `consent_records` | `contact_id`, `channel` (`whatsapp`,`email`,`phone`), `purpose` (`marketing`,`sales_followup`,`service`,`transactional`), `legal_basis` (`consent`,`legitimate_interest`,`contract`,`legal_obligation`), `status` (`granted`,`revoked`,`expired`), `granted_at`, `revoked_at`, `expires_at`, `source` (formulário, WhatsApp opt-in, importação com declaração...), `evidence_id`, `recorded_by`. Nunca editado: mudança = novo registro (histórico); view `current_consents` resolve o vigente por (contato, canal, finalidade). |
| `consent_evidence` | `kind` (`form_submission`,`whatsapp_message`,`signed_document`,`import_declaration`), `payload_hash`, `storage_path`, `ip_hash`, `user_agent`, `captured_at`, `text_version` (texto exato apresentado ao titular). |
| `suppression_list` | `channel`, `phone_e164`/`email_normalized`, `reason` (`opt_out`,`complaint`,`blocked`,`invalid`,`legal_request`), `source`, `created_at`. Único por (tenant, canal, identificador). Checada **por identificador**, não por contato — vale mesmo se o contato for recriado. |
| `privacy_requests` | `kind` (`access`,`correction`,`deletion`,`portability`,`opposition`), `subject_identifier`, `status`, `due_at` (prazo), `handled_by`, `result_path`. |
| `data_retention_policies` | `entity` (`messages`,`webhook_events`,`agent_executions`,`leads_inactive`,...), `retain_days`, `action` (`delete`,`anonymize`). Defaults de plataforma + override por empresa (nunca acima do máximo da plataforma). |

### 4.4 WhatsApp — Fase 3

| Tabela | Colunas principais / regras |
|---|---|
| `whatsapp_accounts` | `waba_id`, `business_id`, `display_name`, `status`, `mode` (`sandbox`,`live`), `credential_secret_id` (referência ao Vault — **nunca o token**), `app_secret_secret_id`, `connected_by`. `unique (waba_id)` global: uma WABA não pode estar em duas empresas. |
| `whatsapp_phone_numbers` | `account_id`, `phone_number_id` (único global), `display_phone`, `verified_name`, `quality_rating`, `messaging_limit_tier`, `status`. |
| `whatsapp_templates` | `account_id`, `name`, `language`, `category` (`marketing`,`utility`,`authentication`), `status` (`approved`,`pending`,`rejected`,`paused`,`disabled`), `components jsonb`, `meta_template_id`, `synced_at`. Só `approved` pode ser usado. |
| `conversations` | `contact_id`, `phone_number_id`, `status` (`open`,`pending_human`,`closed`), `assigned_user_id`, `handled_by` (`agent`,`human`), `agent_id`, `last_inbound_at` (**base da janela de 24 h**), `last_message_at`. Uma conversa aberta por (tenant, contato, número). |
| `messages` | `conversation_id`, `direction` (`inbound`,`outbound`), `sender_type` (`contact`,`user`,`agent`,`system`), `type` (`text`,`template`,`image`,...), `body` (texto), `template_id`, `wa_message_id`, `status` (`queued`,`sent`,`delivered`,`read`,`failed`), `error jsonb`, `send_request_id`, `sent_at`. `unique (phone_number_id, wa_message_id)` — **webhook duplicado não cria duas mensagens**. |
| `message_delivery_events` | `message_id`, `wa_message_id`, `status`, `occurred_at` (timestamp da Meta), `pricing jsonb`, `errors jsonb`. `unique (wa_message_id, status)`; status só avança (sent < delivered < read; failed é terminal) — evento atrasado não regride. |
| `message_send_requests` | **Registro da decisão de envio**: `contact_id`, `conversation_id`, `origin` (`user`,`agent`,`campaign`,`followup`), `origin_id`, `kind` (`free_text`,`template`), `template_id`, `payload jsonb`, `idempotency_key` (único por tenant), `decision` (`allowed`,`blocked`), `checks jsonb` (consentimento, finalidade, supressão, janela 24 h, template aprovado, frequência, limites — cada um com resultado), `decided_at`, `status` (`pending`,`sent`,`failed`,`canceled`), `attempts`. |
| `webhook_events` | G/T: `provider` (`whatsapp`), `dedupe_key` (único: hash de `entry.id + change + message/status id`), `tenant_id` (resolvido pelo `phone_number_id`, nulo se desconhecido), `signature_valid`, `payload jsonb`, `received_at`, `processed_at`, `status`, `attempts`, `last_error`. Retenção curta (ex.: 30 dias). |

### 4.5 Inteligência artificial — Fase 4

| Tabela | Colunas principais / regras |
|---|---|
| `ai_agents` | `type` (`capture`,`sdr`,`followup`,`analyst`), `name`, `objective`, `status` (`active`,`inactive`,`testing`), `current_version_id`, `handoff_policy jsonb`, `limits jsonb` (tokens/execução, US$/dia, execuções/hora, mensagens/conversa). |
| `agent_versions` | `agent_id`, `version int`, `system_prompt`, `provider`, `model`, `params jsonb`, `allowed_tools text[]` (validado contra o catálogo em código), `knowledge_base_ids uuid[]`, `created_by`, `notes`. Imutável; rollback = apontar `current_version_id` para versão anterior. `unique (agent_id, version)`. |
| `agent_assignments` | Onde o agente atua: `agent_id`, `scope` (`phone_number`,`pipeline`,`campaign`,`lead_source`), `scope_id`, `active`. |
| `agent_executions` | `agent_id`, `version_id`, `trigger_type`, `trigger_ref`, `idempotency_key` (único por tenant), `status`, `input_ref jsonb` (ids, não conteúdo), `output jsonb` (proposta validada), `token_usage`, `cost_usd`, `estimated_cost_usd`, `latency_ms`, `error`, `trigger_run_id`, `is_test`. |
| `agent_tool_calls` | `execution_id`, `tool`, `arguments jsonb` (redigido), `decision` (`executed`,`rejected`,`needs_approval`), `result_summary`, `error`. |
| `agent_handoffs` | `conversation_id`, `execution_id`, `reason` (`policy`,`low_confidence`,`user_request`,`sensitive_topic`,`error`), `assigned_user_id`, `status`, `resolved_at`. |
| `knowledge_bases` | `name`, `description`, `kind` (`institutional`,`products`,`faq`,`policies`,`restrictions`). |
| `knowledge_documents` | `knowledge_base_id`, `title`, `source_type` (`upload`,`text`,`url`), `storage_path`, `checksum`, `status` (`pending`,`processing`,`ready`,`failed`), `version`, `valid_until`. |
| `knowledge_chunks` | `document_id`, `chunk_index`, `content`, `tokens`, `fts tsvector` (português), `embedding vector(N)` (N depende de **D-06**; nulo até lá), `metadata jsonb`. Índices: GIN em `fts`, HNSW em `embedding`. |

### 4.6 Campanhas e follow-up — Fase 5

| Tabela | Colunas principais / regras |
|---|---|
| `campaigns` | `name`, `objective`, `purpose` (finalidade exigida no consentimento), `template_id`, `owner_user_id`, `status campaign_status` (`draft`,`validating`,`awaiting_approval`,`scheduled`,`running`,`paused`,`completed`,`canceled`), `starts_at`, `send_window jsonb`, `limits jsonb` (por hora/dia/total), `cost_estimate jsonb`, `approved_by`, `approved_at`, `emergency_stopped_at`. Trigger valida transições permitidas; `approved_by` deve ter papel MANAGER+ e ≠ criador (D-08). |
| `campaign_audiences` | Segmento salvo: `filter jsonb` (tags, estágio, origem, cidade...), `snapshot_at`, `estimated_size`. |
| `campaign_recipients` | `campaign_id`, `contact_id`, `eligibility` (`eligible`,`excluded`), `exclusion_reason`, `send_request_id`, `status`. `unique (campaign_id, contact_id)`. |
| `campaign_runs` | Cada execução/lote: `campaign_id`, `batch_no`, `planned`, `sent`, `blocked`, `failed`, `started_at`, `finished_at`. |
| `followup_rules` | `trigger` (`no_reply_after`,`stage_idle`,...), `delay`, `max_attempts`, `min_interval`, `template_id`, `agent_id`, `active`. |
| `followup_executions` | `rule_id`, `subject_id`, `attempt`, `scheduled_for`, `status`, `send_request_id`, `skip_reason`. `unique (rule_id, subject_id, attempt)`. |

## 5. Idempotência e deduplicação (resumo)

| Risco | Proteção no banco |
|---|---|
| Webhook repetido pela Meta | `webhook_events.dedupe_key` único; `messages (phone_number_id, wa_message_id)` único |
| Status fora de ordem | `message_delivery_events (wa_message_id, status)` único + regra de avanço monotônico |
| Envio duplicado (retry de job) | `message_send_requests (tenant_id, idempotency_key)` único; a chamada à Meta só ocorre após a linha estar `allowed/pending` e é marcada `sent` com `wa_message_id` |
| Resposta duplicada da IA | `agent_executions (tenant_id, idempotency_key)` = `sdr:<inbound wa_message_id>` |
| Contato duplicado | únicos parciais por telefone/e-mail normalizados; importação faz upsert |
| Mesmo contato 2× na campanha | `campaign_recipients (campaign_id, contact_id)` único |
| Gasto acima do limite com concorrência | `reserve_usage` com bloqueio de linha |

## 6. Retenção e exclusão

| Dado | Padrão proposto | Ação |
|---|---|---|
| `webhook_events.payload` | 30 dias | apagar payload, manter metadados 180 dias |
| `messages.body` | enquanto houver relacionamento + 24 meses sem atividade (configurável) | anonimizar corpo |
| `agent_executions.output` / tool args | 90 dias | apagar conteúdo, manter custo e status |
| `audit_logs` | 5 anos | manter (sem conteúdo pessoal no diff) |
| Leads sem atividade e sem consentimento | 12 meses | anonimizar |
| `consent_records` / `consent_evidence` | enquanto houver tratamento + prazo legal de defesa | manter (prova) |
| `suppression_list` | indefinido | manter (necessário para não contatar) — guarda só o identificador |
| Empresa encerrada | suspensa 30 dias → exportação disponível → exclusão em cascata | apagar |

Prazos são propostas para validação jurídica (D-10). O job
`ai-sales-retention` aplica as políticas diariamente em lotes pequenos.

## 7. Plano de migrations

| Fase | Migration | Conteúdo |
|---|---|---|
| 1 | `..._sales_platform.sql` | enums, schema `private`, helpers de autorização, organizations, members, invites, settings, platform_admins, plans, subscriptions, usage, audit, rate_limits, RLS, grants, triggers |
| 1 | `..._sales_seed_dev.sql` | **só em dev**: planos "interno", empresas fictícias "Demo A/B" claramente marcadas — para testes de isolamento. Não roda em produção (fica fora de `migrations/`, aplicada por script). |
| 2 | `..._sales_crm.sql` / `..._sales_consent.sql` | CRM, consentimento, privacidade, Storage bucket `sales-imports` |
| 3 | `..._sales_whatsapp.sql` | WhatsApp, webhooks, send requests, Vault |
| 4 | `..._sales_agents.sql` / `..._sales_knowledge.sql` | agentes, execuções, conhecimento, `create extension vector` |
| 5 | `..._sales_campaigns.sql` | campanhas, follow-up |
| 7 | `..._sales_billing.sql` | entitlements adicionais, saúde de integrações |

Toda migration é aditiva. Alterações destrutivas (drop/rename de coluna com
dados) seguem expand/contract e **exigem aprovação explícita**.
