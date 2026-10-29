# PeriniHub AI Sales — Operação

> Status: **Fase 8 (2026-10-29)**. O projeto Supabase "AI Sales" passou a
> ser o de **produção** (D-01/D-02 revistos); o código vai para a `main` com
> `AI_SALES_ENABLED` desligado na Vercel até o checklist do §7. Operação do
> portal Tech: `docs/tech-portal.md`.

## 1. Ambientes

| Ambiente | App | Banco | Trigger.dev | WhatsApp | IA |
|---|---|---|---|---|---|
| Local | `npm run dev` | Supabase de desenvolvimento (D-01) | ambiente `dev` (`npx trigger.dev dev`) | `mock` | mock por padrão; real com chave e orçamento dev |
| Preview (PR) | Vercel Preview | Supabase de desenvolvimento | `dev`/`preview` | `mock` ou número de teste da Meta | orçamento dev |
| Produção | perinihub.com.br | Supabase de produção do AI Sales | `prod` | `live` só após D-05 e checklist §7 | orçamento prod |

Feature flag `AI_SALES_ENABLED` (env): quando ausente/`false`, `/ai-sales`
responde 404 e nenhuma tarefa do AI Sales é agendada. Permite fazer merge na
`main` sem expor o produto (cenário crítico 10: a ausência não afeta o site).

## 2. Variáveis de ambiente (novas)

| Variável | Onde | Observação |
|---|---|---|
| `AI_SALES_ENABLED` | next, worker | flag geral |
| `NEXT_PUBLIC_SALES_SUPABASE_URL`, `NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY`, `SALES_SUPABASE_SECRET_KEY`, `SALES_SUPABASE_DB_URL` | next, worker, local | projeto Supabase "AI Sales" (D-01); secret nunca com `NEXT_PUBLIC`; DB URL só local (migrations) |
| `AI_SALES_ANTHROPIC_API_KEY` | worker | chave de workspace separado (D-04) |
| `AI_SALES_EMBEDDINGS_API_KEY` | worker | D-06 |
| `AI_SALES_GLOBAL_MONTHLY_AI_LIMIT_USD` | worker | teto global além dos limites por empresa |
| `WHATSAPP_MODE` | next, worker | `mock` \| `live` |
| `WHATSAPP_GRAPH_API_VERSION` | next, worker | versão fixada |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | next | `openssl rand -hex 32` |
| `WHATSAPP_APP_SECRET` | next | se app único da PeriniHub; senão Vault |
| `AI_SALES_IP_HASH_SALT` | next | sal para hash de IP |

`.env.example` e `trigger.config.ts` (`WORKER_ENV`) serão atualizados na fase
em que cada variável passar a ser usada. Nenhuma credencial é commitada.

## 2.1 Comandos do AI Sales (Fase 1)

| Comando | Para quê |
|---|---|
| `npm run db:sales:push` | aplica as migrations de `supabase-sales/` no projeto "AI Sales" (`SALES_SUPABASE_DB_URL`) |
| `npm run db:sales:types` | regera `src/lib/supabase/sales.types.ts` |
| `npm run test:integration:sales` | testes de isolamento/RLS contra o banco real (criam e apagam dados `zz-teste-*`) |
| `set -a && . ./.env.local && set +a && node scripts/ai-sales-admin.mjs bootstrap <email>` | cria (se preciso) a conta e a torna superadmin; a senha é definida em `/ai-sales/recuperar-senha` |

Configuração no painel do Supabase "AI Sales" (Authentication → URL
Configuration): **Site URL** do ambiente e **Redirect URLs** com
`http://localhost:3000/ai-sales/auth/callback` (dev) e, quando houver,
`https://perinihub.com.br/ai-sales/auth/callback`. Sem isso o link de
recuperação de senha é recusado. Cadastro público: **desligado**.

## 2.2 WhatsApp (Fase 3)

| Variável | Valor |
|---|---|
| `WHATSAPP_MODE` | `mock` (dev/preview) ou `live` (produção, desliga o simulado) |
| `WHATSAPP_GRAPH_API_VERSION` | `v26.0` |
| `WHATSAPP_APP_SECRET` | App Secret do app da Meta |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `openssl rand -hex 24` |

No app da Meta (WhatsApp → Configuração): URL de callback
`https://perinihub.com.br/api/ai-sales/webhooks/whatsapp`, o verify token
acima e assinatura dos campos `messages` (e `smb_message_echoes` em
coexistência). Eventos com falha ficam em `webhook_events` (5 tentativas →
`dead_letter`); o reprocessamento automático entra na Fase 5.

## 2.3 Evolution (D-17)

| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL do servidor (a mesma do PeriniFood) |
| `EVOLUTION_API_KEY` | chave do servidor (64 hex) |
| `EVOLUTION_WEBHOOK_SECRET` | `openssl rand -hex 24` |

Limite diário de mensagens proativas por número: Configurações → WhatsApp
(padrão 10, máximo 30). Se o número for banido ou desconectar, a conversa
fica sem envio até reconectar; não reaproveitar o número na API oficial
sem migrá-lo.

## 2.4 Tarefas agendadas do AI Sales (Fase 5)

| Tarefa | Quando | O que faz |
|---|---|---|
| `ai-sales-reprocess-events` | a cada 10 min | reprocessa eventos do WhatsApp com falha/pendentes (5 tentativas → dead letter) |
| `ai-sales-campaign-tick` | a cada 10 min | próximo lote de cada campanha agendada/em execução |
| `ai-sales-followup-tick` | 9h15–18h15, dias úteis (São Paulo) | regras ativas de follow-up |
| `ai-sales-retention` | 03:30 todo dia (São Paulo) | `apply_retention`: payload de webhooks (30 d), webhooks (180 d), conteúdo de execuções de agentes (90 d), limites de tentativa (1 d), convites vencidos (30 d) — prazos em `retention_policies` |

Rodam no mesmo worker do portal. Sem `AI_SALES_ENABLED=true` e as chaves do
Supabase "AI Sales" no ambiente de quem implanta, ficam inertes (o
`trigger.config.ts` só envia essas variáveis se existirem). Nas telas há
"Enviar próximo lote agora" e "Rodar regras ativas agora" para operar sem o
worker.

## 3. Deploy

- **Site**: igual ao atual — PR → preview automático → merge na `main` →
  produção. Merges na `main` e variáveis de produção são executados pelo
  usuário (o modo automático bloqueia o agente nessas ações).
- **Migrations**: desde a Fase 8 só existe o projeto "AI Sales" (produção).
  Migrations aditivas, aplicadas pelo usuário (`npm run db:sales:push`) antes
  do deploy do código que depende delas. Os testes de integração criam e
  apagam usuários/empresas `zz-teste` e exigem
  `AI_SALES_INTEGRATION_ALLOWED=true`; quando houver dados reais, criar um
  projeto de desenvolvimento e apontar as variáveis dos testes para ele.
- **Worker**: `set -a; . ./.env.local; set +a; npx trigger.dev@4.8.1 deploy`
  (o mesmo worker do portal). Um deploy do AI Sales também redeploya as
  tarefas do portal — rodar a suíte inteira antes.
- **Ordem segura**: migration aditiva → worker → site. Remoções seguem
  expand/contract.

## 4. Observabilidade

- Painel `/ai-sales/platform/saude`: webhooks recebidos/pendentes/falhos,
  fila de envios, execuções de agentes com erro, gasto de IA vs. limites,
  qualidade dos números, dead letters.
- Logs estruturados no Trigger.dev e na Vercel com `tenantId`,
  `requestId`/`runId`, sem dados pessoais (SECURITY §10).
- Alertas iniciais por e-mail ao SUPERADMIN (via tarefa diária, como o
  `daily-news-report`): falhas persistentes, gasto > 80% do limite, número com
  qualidade baixa, webhook sem eventos há N horas quando esperado.

## 5. Runbooks

### 5.1 Pausa de emergência de envios

1. `/ai-sales/[org]/campaigns/[id]` → "Pausa de emergência" (MANAGER+), ou
   `/ai-sales/platform` → "Pausar todos os envios da empresa" / "global".
2. Efeito: `emergency_stopped_at` gravado, runs pendentes cancelados, gate
   recusa qualquer envio dessa origem. Mensagens já aceitas pela Meta não
   podem ser recolhidas.
3. Registrar motivo; retomar exige nova aprovação.

### 5.2 Webhook falhando

- 401 em massa → app secret trocado/errado; conferir Vault/env.
- Eventos `pending` acumulando → worker parado ou erro de processamento; ver
  runs `ai-sales-process-whatsapp-event`; `ai-sales-reconcile` reenfileira.
- A Meta reenvia por um período quando não recebe 200; a dedupe evita efeitos
  duplicados.

### 5.3 Gasto de IA acima do esperado

- Reservas recusadas aparecem como execuções `skipped: budget`. Desativar o
  agente (status `inactive`) para parar imediatamente; ajustar limites.
- O limite de gasto do workspace na Anthropic é a segunda barreira.

### 5.4 Pedido de titular (LGPD)

Registrar em `privacy_requests` → exportação ou anonimização pela tela de
privacidade → anexar resultado → responder no prazo. Opt-out é imediato e não
depende deste fluxo.

### 5.5 Rotação de segredos

- Token da WABA: gerar novo no Business Manager → atualizar na tela de
  integração (grava no Vault) → revogar o antigo.
- Secret key do Supabase / chaves de IA: criar nova → atualizar Vercel e
  redeploy do worker (syncEnvVars) → revogar a antiga.
- Verify token / app secret: atualizar env e configuração do webhook na Meta
  na mesma janela.

## 6. Resposta a incidentes

1. **Detectar e conter**: pausar envios/agentes, revogar credenciais
   suspeitas, suspender a empresa afetada se necessário.
2. **Avaliar**: quais tenants, quais dados, desde quando (audit_logs, logs
   da Vercel/Trigger/Supabase).
3. **Comunicar**: empresas clientes afetadas (são controladoras) e, quando a
   PeriniHub for controladora ou por obrigação contratual, ANPD e titulares
   se houver risco ou dano relevante, no prazo regulamentar.
4. **Corrigir e registrar**: causa raiz, correção, teste de regressão,
   entrada no histórico de incidentes.

## 7. Checklist antes de ativar produção (Fase 8)

Situação em 2026-10-29 (✅ feito · ⏳ depende do usuário · ⛔ bloqueia clientes externos):

- ✅ Testes de isolamento entre tenants, RLS e privilégios de funções passando contra o banco de produção vazio (os 10 cenários críticos: §7.1)
- ✅ Banco de produção sem dados de teste (só o superadmin e o plano "Interno")
- ✅ Retenção ativa (`ai-sales-retention`); limites de plano aplicados no banco (Fase 7)
- ⏳ Cadastro público desligado no Supabase Auth (Authentication → Sign In / Providers → "Allow new users to sign up" desligado)
- ⏳ URLs de redirecionamento do Auth: `https://perinihub.com.br/ai-sales/auth/callback` (e o domínio de preview, se usar)
- ⛔ MFA do superadmin (D-16): ativar TOTP no Supabase e `AI_SALES_PLATFORM_REQUIRE_MFA=true`
- ⏳ Backups: plano gratuito tem backup diário sem PITR e sem restauração testada; para clientes externos, plano Pro + PITR e um teste de restauração
- ⏳ SMTP próprio (D-07) configurado no Supabase Auth (convites e recuperação)
- ⛔ WhatsApp: WABA verificada, número de produção, webhook validado, templates aprovados (D-05)
- ⏳ Limite de gasto na Anthropic: a chave é a mesma do portal (o uso do AI Sales pode esgotar o teto do /tech)
- ⛔ Termos de uso, política de privacidade e contrato de operador revisados por advogado (D-10)
- ⏳ Runbooks testados (pausa de emergência, rotação de token) — §5
- ⏳ `AI_SALES_ENABLED=true` em produção por decisão explícita (§8)

### 7.1 Cenários críticos automatizados

| # | Cenário | Teste |
|---|---|---|
| 1 | Empresa A nunca vê nem altera dados da B | `tenants/isolation.integration.test.ts`, `crm.integration.test.ts` (isolamento), `capture.integration.test.ts` (permissões) |
| 2 | Funções do servidor não são chamáveis por anônimo/usuário | `security/privileges.integration.test.ts` |
| 3 | Webhook duplicado = 1 mensagem | `whatsapp.integration.test.ts` |
| 4 | Sem consentimento compatível não recebe | `whatsapp.integration.test.ts`, `campaigns.integration.test.ts` |
| 5 | "SAIR" descadastra e bloqueia envios | `whatsapp.integration.test.ts`, `campaigns.integration.test.ts` |
| 6 | Fora da janela de 24 h só template | `whatsapp.integration.test.ts` |
| 7 | Segredos nunca chegam ao cliente | `whatsapp.integration.test.ts` (cenário 7) |
| 8 | Campanha pausada não envia; emergência não retoma | `campaigns.integration.test.ts` |
| 9 | Mesma mensagem não gera duas respostas do agente | `agents.integration.test.ts` |
| 10 | Flag desligada: `/ai-sales` 404 e o site intacto | `npm run smoke` (o CI roda sem a flag; localmente, com a flag, confere login e redirecionamento) |

## 8. Ativação e acesso

**Local (hoje):** `npm run dev` e abrir `http://localhost:3000/ai-sales/login`
com o superadmin `contato@perinihub.com.br`. Primeira senha: "Esqueci a
senha" em `/ai-sales/recuperar-senha` (exige o e-mail do Supabase e a URL
`http://localhost:3000/ai-sales/auth/callback` nas URLs permitidas do Auth).
O superadmin cria as empresas em `/ai-sales/platform` e envia o convite de
proprietário; depois escolhe a empresa em `/ai-sales/selecionar-empresa`.

**Produção (quando decidir ligar):**
1. Vercel → Production: `AI_SALES_ENABLED=true`,
   `NEXT_PUBLIC_SALES_SUPABASE_URL`, `NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY`,
   `SALES_SUPABASE_SECRET_KEY`, `AI_SALES_IP_HASH_SALT` (`openssl rand -hex 32`);
   WhatsApp/Evolution/Anthropic conforme o que for usar.
2. Supabase Auth: redirect `https://perinihub.com.br/ai-sales/auth/callback`,
   cadastro público desligado, SMTP próprio.
3. Redeploy de produção na Vercel; conferir `/ai-sales/login` e
   `npm run smoke` contra a produção.
4. Desligar: `AI_SALES_ENABLED=false` + redeploy (o worker continua inerte
   sem a flag no próximo deploy dele).
