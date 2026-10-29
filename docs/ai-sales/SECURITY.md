# PeriniHub AI Sales — Segurança e LGPD

> Status: **Fase 0 (proposta)**. Controles marcados com a fase em que entram.
> Nada aqui está ativo ainda.

## 1. Modelo de ameaças (resumo)

| Ativo | Ameaça | Controle principal |
|---|---|---|
| Dados de leads/conversas de cada empresa | Acesso cruzado entre tenants (bug no app, troca de parâmetro, IDOR) | RLS por `tenant_id` + FK composta + DAL `requireMember` + testes de isolamento (F1) |
| Tokens da Meta, chaves de IA | Vazamento para o navegador, logs ou agentes | Segredos só no servidor/worker; tokens de tenant no Supabase Vault; agentes sem acesso a segredos (F3/F4) |
| Contas de usuário | Credential stuffing, sequestro de sessão | Rate limit, mensagem única de erro, cookies httpOnly, MFA (F1) |
| Webhook do WhatsApp | Eventos forjados ou reenviados | Assinatura `X-Hub-Signature-256` + dedupe + idempotência (F3) |
| Reputação do número / titulares | Envio sem consentimento, spam, descadastro ignorado | Gate de envio determinístico, supressão, aprovação de campanha, pausa de emergência (F3/F5) |
| Agentes de IA | Prompt injection via mensagem/documento, ferramenta abusada, custo descontrolado | Entrada não confiável isolada, catálogo fechado de ferramentas, validação de saída, orçamento reservado (F4) |
| Plataforma | Abuso do superadmin | Ações só no servidor, AAL2, auditoria com motivo (F1/F7) |

## 2. Autenticação e sessão (Fase 1)

- Supabase Auth (e-mail/senha), cookies via `@supabase/ssr`; `getClaims()`
  valida a assinatura do JWT em cada requisição do servidor — nunca
  `getSession()` para autorizar.
- `proxy.ts` só **renova** a sessão em `/ai-sales/*` e redireciona anônimos ao
  login; **não é barreira de autorização** (mesma regra do painel). O webhook
  e os formulários públicos ficam fora do matcher.
- Login: Server Action com Zod, `consume_rate_limit` por IP (hash) e por
  e-mail (ex.: 5 tentativas/15 min), além do limite nativo do Supabase Auth.
  Erro único ("e-mail ou senha inválidos").
- Senha mínima 10 caracteres + checagem de senhas vazadas (opção do Supabase
  Auth, disponível conforme plano — D-01).
- **Cadastro público desligado** (ADR-004). Checar em Auth → Providers que
  "Allow new users to sign up" está desativado no projeto usado (A2).
- Convites: token de 32 bytes (`crypto.randomBytes`), só o SHA-256 no banco,
  expira em 7 dias, uso único, vinculado ao e-mail convidado.
- Recuperação de senha via PKCE; `redirectTo` restrito às URLs cadastradas.
- MFA TOTP: previsto como obrigatório para SUPERADMIN; **adiado por decisão
  do usuário (D-16)** — o DAL exige `aal2` quando
  `AI_SALES_PLATFORM_REQUIRE_MFA=true`. Opcional para empresas e exigível por
  `organization_settings.require_mfa` (fases seguintes).
- Conta criada pelo convite nasce com e-mail confirmado: quem tem o token
  recebeu o link no e-mail convidado (mesmo princípio de um link mágico). O
  token só existe em hash no banco e a página aceita só tokens no formato.
- Logout invalida a sessão no servidor (`signOut({ scope: 'local' })`) e
  "sair de todos os dispositivos" com `scope: 'global'`.

## 3. Autorização

- **Três camadas**: (1) DAL no servidor (`requireMember(org, minRole)` em
  layouts, páginas, actions e route handlers); (2) RLS no banco com as mesmas
  regras; (3) FKs compostas para integridade entre tenants.
- Server Actions recebem ids, **nunca `tenant_id` do cliente como fonte de
  verdade**: o tenant vem do slug resolvido pelo DAL e é conferido contra o
  registro.
- Respostas a recursos de outra empresa = 404 (não 403), para não confirmar
  existência.
- Superadmin: tabela `platform_admins` sem policy para `authenticated`;
  operações de plataforma no servidor com service role, após
  `requirePlatformAdmin()` (AAL2) e com `audit_logs` obrigatório. Acesso a
  dados de conversa de um tenant só em modo "suporte" com motivo registrado.
- Matriz papel × permissão versionada em código e espelhada no SQL; teste
  automatizado compara as duas.

## 4. Segredos e credenciais

| Segredo | Onde vive | Quem lê |
|---|---|---|
| Supabase secret key (service role) | Vercel (sem `NEXT_PUBLIC`), Trigger.dev | rotas do servidor que precisam (webhook, plataforma) e worker |
| Chaves de IA da plataforma | Trigger.dev (e Vercel só se houver execução síncrona — evitar) | `LlmProvider` |
| Token de acesso da WABA de cada empresa | **Supabase Vault** (`vault.secrets`), referenciado por id em `whatsapp_accounts` | função `security definer` executável só pelo `service_role`, chamada pelo worker |
| App Secret da Meta (assinatura do webhook) | Vault (por app) ou env se houver um único app da PeriniHub | rota do webhook |
| Verify token do webhook | env `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | rota do webhook (GET) |

Regras: nenhum segredo em `NEXT_PUBLIC_*`, em colunas legíveis por
`authenticated`, em `audit_logs`, em logs do Trigger ou em prompts. A UI
mostra só "configurado em dd/mm por fulano" e últimos 4 caracteres.
`requireSecret()` (já existente) continua sem ecoar valores em erros.
Rotação documentada em OPERATIONS.md.

## 5. Webhooks do WhatsApp (Fase 3)

1. `GET` de verificação: compara `hub.verify_token` com o env em tempo
   constante e devolve `hub.challenge`.
2. `POST`: lê o **corpo bruto** (`request.text()`), calcula
   `HMAC-SHA256(app_secret, raw)` e compara com `X-Hub-Signature-256` via
   `crypto.timingSafeEqual`. Assinatura inválida → 401 e registro mínimo
   (sem payload).
3. Limite de tamanho do corpo (ex.: 1 MB) e `Content-Type` JSON.
4. Persiste em `webhook_events` com `dedupe_key` único (`on conflict do nothing`)
   e enfileira `process-whatsapp-event` com `idempotencyKey = dedupe_key`.
   Responde 200 em < 1 s; nenhum processamento pesado na rota.
5. **Replay**: a Meta não assina timestamp, então a proteção é a idempotência
   (mesmo evento reenviado não produz efeito) + descarte de status mais antigo
   que o estado atual + alerta para eventos com `timestamp` muito antigo.
6. `phone_number_id` desconhecido → evento guardado sem tenant e ignorado.

## 5.1 Privilégios de funções (incidente da Fase 3)

No Postgres, `CREATE FUNCTION` concede EXECUTE a PUBLIC. Regra do projeto:
toda migration nova que cria função termina com `revoke execute ... from
public, anon[, authenticated]` e concede só o necessário; a migration
`20261030120200_sales_function_privileges.sql` também removeu o padrão
global (`alter default privileges revoke execute on functions from public`).
O teste `security/privileges.integration.test.ts` chama cada função
restrita como anônimo e como usuário logado e exige `42501`; função nova
só do servidor entra na lista.

## 6. Gate de envio (Fase 3, usado pela Fase 5) — implementado em `whatsapp_send_gate`

Função única no servidor (`features/ai-sales/whatsapp/send-gate.ts` +
função SQL transacional) chamada **imediatamente antes** de cada envio
iniciado pela empresa, por humano, agente, campanha ou follow-up:

1. Empresa ativa, número conectado e em modo `live` (ou `sandbox` → cliente
   simulado).
2. Contato não está em `suppression_list` (por telefone, canal WhatsApp).
3. Mensagem livre: só se `now() - conversations.last_inbound_at < 24 h`.
   Fora da janela: só template `approved`.
4. Template de marketing/utility ou mensagem proativa: consentimento vigente
   para canal `whatsapp` **e** finalidade compatível com a da campanha.
5. Frequência: limite por contato (ex.: 1 marketing/7 dias, configurável) e
   horário silencioso da empresa.
6. Limites de plano e reserva de custo (`reserve_usage`).
7. Campanha (se houver) em `running` e sem `emergency_stopped_at`.
8. Grava `message_send_requests` com `decision` e o resultado de **cada**
   checagem. Só então a mensagem é enviada.

Opt-out: mensagens recebidas com intenção de descadastro (palavras-chave
"SAIR", "PARAR", "STOP", "DESCADASTRAR" + classificação por IA como apoio,
nunca como única condição) e o botão de opt-out de templates de marketing
geram, na mesma transação, registro em `suppression_list`, revogação do
consentimento e cancelamento de envios pendentes. Confirmação ao titular é
uma única mensagem de serviço (dentro da janela).

## 7. Agentes de IA (Fase 4) — implementado

> Como foi feito: o modelo devolve saída estruturada (Zod) e o código aplica
> só `conversation.reply` (sempre pelo gate de envio), `conversation.handoff`
> e `crm.update_lead` (interesse/pontuação), todas registradas em
> `agent_tool_calls`. Sem SQL, HTTP livre ou segredos. Afirmação de preço,
> prazo ou especificação sem trecho citado da base → transferência.
> Idempotência por mensagem (`sdr:<id>`) e por envio (`agent:<execução>`).

- Conteúdo de clientes, documentos e páginas entra no prompt como **dado**
  delimitado (`wrapUntrusted`, já existente), com regras no system prompt.
- **Catálogo fechado de ferramentas** em código (ex.: `crm.update_lead_fields`
  com lista de campos permitidos, `crm.add_note`, `crm.create_task`,
  `knowledge.search`, `conversation.request_handoff`,
  `whatsapp.propose_reply`). Cada ferramenta: schema Zod, papel equivalente
  mínimo, tenant fixado pelo executor (não pelo modelo), efeitos registrados
  em `agent_tool_calls`.
- Nenhuma ferramenta executa SQL arbitrário, faz HTTP livre, lê segredos ou
  acessa outra empresa. Busca externa (Fase 6) só via `safeFetch` e lista de
  provedores permitidos.
- Ações com efeito externo (enviar mensagem, mudar estágio para Ganho,
  agendar contato) passam pelo gate e pelas regras de negócio; o modelo só
  propõe. Política por agente define o que exige aprovação humana.
- Respostas sobre preço, prazo, certificação ou especificação técnica só com
  trecho da base de conhecimento citado (`source_chunk_ids` obrigatório no
  schema de saída); sem fonte → resposta padrão + handoff.
- Orçamento: `reserve_usage` antes de cada chamada (por agente, por empresa e
  global), limites de tokens por execução e de execuções por conversa/hora.
- Falha do provedor nunca gera resposta duplicada: idempotência por mensagem
  recebida e envio só via `message_send_requests`.

## 8. Entradas, APIs e navegador

- Zod em toda Server Action e route handler; limites de tamanho em textos e
  uploads; CSV processado no worker, com limite de linhas e colunas e
  neutralização de fórmulas (`=`, `+`, `-`, `@`) na exportação.
- Uploads: bucket privado, `{tenant_id}/` no caminho, tipo e tamanho
  validados, URLs assinadas de curta duração.
- Formulários públicos de captação: rate limit por IP, honeypot, consentimento
  com texto versionado e evidência registrada; Turnstile se houver abuso (D-11).
- Headers existentes mantidos; `/ai-sales` e `/api/ai-sales` com
  `X-Robots-Tag: noindex`. Fase 8 avalia CSP com nonce só em `/ai-sales`.
- Server Actions do Next já checam Origin; nada de CORS aberto nas rotas.

## 9. Rate limiting

Sem Redis no projeto hoje. Proposta:

- **Postgres** (`consume_rate_limit`) para login, convites, formulários e
  ações sensíveis — volume baixo, sem nova dependência.
- **Vercel Firewall** (regras de rate limit por caminho) para
  `/api/ai-sales/forms/*` e `/ai-sales/login` como primeira linha.
- **Trigger.dev queues** (`concurrencyLimit` + `concurrencyKey = tenantId`)
  para chamadas à Meta e aos provedores de IA.

Se o volume crescer, reavaliar Upstash Redis (Marketplace da Vercel).

## 10. Logs e auditoria

- `audit_logs` append-only para: membros e papéis, integrações, agentes e
  versões, aprovações e pausas de campanha, exportações, pedidos de titular,
  ações de superadmin.
- Logs estruturados (JSON) no Trigger/Vercel **sem** corpo de mensagem,
  telefone completo ou e-mail: usar ids e telefone mascarado (`+55 11 9****-8888`).
- IPs guardados como hash com sal (`ip_hash`) quando necessários.

## 11. LGPD

| Tema | Abordagem |
|---|---|
| Papéis | Para dados dos leads de cada cliente, **a empresa cliente é controladora** e a PeriniHub é **operadora**; para dados de usuários da plataforma e para o uso interno, a PeriniHub é controladora. Exige contrato/termo de tratamento com cada empresa (D-10). |
| Base legal | Registrada por tratamento em `consent_records.legal_basis`. Contato comercial ativo por WhatsApp: consentimento (opt-in) como regra; legítimo interesse só com avaliação documentada pela empresa, e nunca dispensa as regras da Meta. |
| Consentimento × autorização comercial | Verificações separadas: LGPD (base legal/finalidade) e política da Meta (opt-in para receber mensagens da empresa). O gate exige as duas. |
| Minimização | Captação guarda só campos necessários; proveniência por campo (`provenance`). Telefone público descoberto ≠ autorização. |
| Direitos do titular | `privacy_requests` com prazo, exportação dos dados do titular e anonimização; opt-out imediato. |
| Retenção | `data_retention_policies` + job diário (DATABASE §6). |
| Suboperadores | Supabase, Vercel, Trigger.dev, Anthropic (e OpenAI/Voyage se D-06), Meta. Registrar região de cada um e transferência internacional; preferir região de dados mais próxima disponível (D-01). |
| Incidentes | Plano em OPERATIONS.md §6 (avaliação, contenção, comunicação à ANPD e titulares quando houver risco relevante). |

> Este documento não substitui avaliação jurídica. Textos de consentimento,
> termos de uso, política de privacidade e contrato de operador precisam de
> revisão por advogado antes do primeiro cliente externo.

## 11. Revisão de segurança da Fase 8 (2026-10-29)

Revisão independente (agente auditor, só leitura) de migrations, rotas sem
sessão, server actions, agentes e cabeçalhos. 0 crítico, 1 alto, 3 médios,
5 baixos — todos corrigidos na migration `20261105130000_sales_security_fixes.sql`
e no código, com testes:

| Nível | Achado | Correção |
|---|---|---|
| Alto | Chave de idempotência do envio vinha do cliente; o gate devolvia a linha aprovada só pela chave e o envio usava os dados da nova chamada → um vendedor furava supressão, consentimento e janela | gate recusa a mesma chave com outro destino/conteúdo (`idempotency_conflict`); chave do servidor com o id do usuário; envio reivindica a linha (`pending → sending`) e usa contato, número e corpo da linha validada |
| Médio | Admin do tenant definia modelo e preço do agente (preço 0 furava o teto de IA) | catálogo `ai_model_catalog` da plataforma; `create_agent_version` só aceita modelo pago do catálogo e grava o preço dele |
| Médio | `created_by` gravável na campanha → gestor aprovava a própria campanha | autoria por trigger (`stamp_actor`) em campanhas, agentes e regras; coluna fora do grant |
| Médio | Formulário público completava telefone/e-mail de contato existente e gravava consentimento → anônimo com o e-mail de um cliente punha o próprio número no contato dele | envio público não altera identificadores de contato existente (vira nota para revisão); consentimento só no identificador que o titular informou e que está no contato |
| Baixo | SDR aplicava pontuação e nota livres vindas do modelo (prompt injection) | só o interesse é aplicado; nota marcada como texto da IA |
| Baixo | Enriquecimento chamável pelo cliente com dados forjados | `company_apply_enrichment` só pelo servidor, com o autor conferido |
| Baixo | Corpo do webhook lido inteiro antes do limite (chunked) | `readBodyLimited` nos webhooks e no formulário público |
| Baixo | `resolved_by` da transferência gravável | trigger com `auth.uid()` |
| Baixo | Leitor via todos os leads com visibilidade "atribuídos" | `viewer` segue a regra do vendedor |

Verificado e OK: privilégios das funções novas, RLS e FKs compostas das
tabelas novas, assinaturas dos webhooks, honeypot/limites do formulário,
convites, checagem de papel em todas as actions, exportação, cabeçalhos.
Pendências conhecidas: CSP com nonce (ADR-016), MFA do superadmin (D-16) e
HSTS explícito (a Vercel envia por padrão; conferir no domínio).
