# PeriniHub AI Sales — Operação

> Status: **Fase 0 (proposta)**. Procedimentos a validar à medida que cada
> fase entra. Operação do portal Tech: `docs/tech-portal.md` (inalterada).

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

Rodam no mesmo worker do portal. Sem `AI_SALES_ENABLED=true` e as chaves do
Supabase "AI Sales" no ambiente de quem implanta, ficam inertes (o
`trigger.config.ts` só envia essas variáveis se existirem). Nas telas há
"Enviar próximo lote agora" e "Rodar regras ativas agora" para operar sem o
worker.

## 3. Deploy

- **Site**: igual ao atual — PR → preview automático → merge na `main` →
  produção. Merges na `main` e variáveis de produção são executados pelo
  usuário (o modo automático bloqueia o agente nessas ações).
- **Migrations**: aplicadas primeiro no banco de desenvolvimento, testadas
  (`npm run test:integration` + testes de RLS), e só em produção com
  aprovação explícita, antes do deploy do código que depende delas.
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

- [ ] Testes de isolamento entre tenants e de RLS passando contra o banco de produção vazio
- [ ] Cadastro público desligado no Supabase Auth; MFA do SUPERADMIN ativo
- [ ] Backups/PITR conforme plano do Supabase escolhido; restauração testada
- [ ] SMTP próprio configurado (convites, recuperação)
- [ ] WhatsApp: WABA verificada, número de produção, webhook validado, templates aprovados
- [ ] Limites globais e por empresa definidos; limite de gasto na Anthropic
- [ ] Termos de uso, política de privacidade e contrato de operador revisados por advogado
- [ ] Runbooks testados (pausa de emergência, rotação de token)
- [ ] `AI_SALES_ENABLED=true` em produção por decisão explícita
