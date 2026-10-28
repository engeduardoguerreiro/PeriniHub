# PeriniHub AI Sales — Plano de implementação

> Estado: **Fase 0 concluída (documentação)** em 2026-10-28, branch
> `feature/ai-sales-fase-0`. **Fase 1 concluída** em 2026-10-28 e **Fase 2**
> em 2026-10-29 (branch `feature/ai-sales-fase-2`). Próxima: Fase 3
> (WhatsApp oficial). **Fase 3 em modo simulado** em 2026-10-30 (branch
> `feature/ai-sales-fase-3`); modo real aguarda credenciais da Meta.
> **Fase 4** em 2026-11-01 (branch `feature/ai-sales-fase-4`), agentes em modo
> simulado até a chave própria da Anthropic (D-04). **Fase 5** em 2026-11-02
> (branch `feature/ai-sales-fase-5`).

Regras para todas as fases:

- Cada fase em branch própria, PR com CI verde; produção só com autorização.
- Migrations aditivas, aplicadas primeiro em desenvolvimento.
- Ao final: arquivos alterados, decisões, migrations, resultado dos testes,
  endpoints/componentes, riscos, o que funciona × o que depende de credenciais.
- Nenhum dado comercial real em dev; nenhum indicador fictício em produção.
- Flag `AI_SALES_ENABLED` desligada em produção até a Fase 8.

---

## Fase 0 — Auditoria e arquitetura ✅

Entregue: os 7 documentos de `docs/ai-sales/`. Sem código nem banco alterados.

## Fase 1 — Multi-tenant, autenticação e segurança ✅ (2026-10-28, branch `feature/ai-sales-fase-1`)

**Entregue:** migration `supabase-sales/supabase/migrations/20261028200000_sales_platform.sql`
aplicada no projeto "AI Sales" (desenvolvimento); login, recuperação e
redefinição de senha, convites por link, criação de conta pelo convite,
seletor de empresa, layout com barra lateral e tema claro/escuro, dashboard
sem números inventados, membros (convidar, papel, desativar, remover),
dados da empresa, auditoria e painel do superadmin (criar, suspender,
reativar, novo convite de proprietário). Superadmin `contato@perinihub.com.br`
criado por `scripts/ai-sales-admin.mjs`.

**Testes:** 22 de integração contra o banco real (`npm run test:integration:sales`),
24 unitários novos (papéis, caminhos, tokens, senha, ações barradas,
proxy), smoke com a flag ligada e desligada, teste manual no navegador do
fluxo superadmin → empresa → convite → aceite → conta nova de vendedor.

**Diferenças em relação ao plano:**
- Convites são entregues por **link copiado** por quem convida (sem e-mail
  automático até existir SMTP próprio — D-07).
- O cookie de "última empresa" não foi feito: com uma empresa o login vai
  direto a ela; com várias, ao seletor.
- MFA do superadmin adiado (D-16).
- Cada página tem o próprio `<Suspense>` (exigência da validação de
  navegação instantânea do Next 16) e o DAL chama `connection()` antes de
  validar o JWT.

**Plano original da fase (referência):**

**Objetivo:** esqueleto seguro: empresas, membros, papéis, login, convites,
seleção de empresa, painel mínimo do superadmin, auditoria e testes de
isolamento.

Arquivos previstos:

| Arquivo | Ação |
|---|---|
| `supabase-sales/config.toml` + `supabase-sales/migrations/…_sales_platform.sql` | novo: migration de plataforma (DATABASE §4.1) |
| `supabase-sales/seed-dev.sql` + `scripts/ai-sales-seed-dev.mjs` | novo: empresas Demo A/B e usuários de teste, só dev |
| `src/lib/env.ts` | alterar: variáveis do AI Sales e flag |
| `src/lib/supabase/sales-{server,service}.ts`, `sales.types.ts`; `package.json` (scripts `db:sales:push`, `db:sales:types`) | novo |
| `src/proxy.ts` | alterar: matcher `/ai-sales/:path*`, login próprio, flag |
| `next.config.ts` | alterar: `X-Robots-Tag` em `ai-sales` |
| `src/app/robots.ts` | alterar: `Disallow: /ai-sales` |
| `src/features/ai-sales/auth/{dal,roles,rate-limit}.ts` (+ testes) | novo |
| `src/features/ai-sales/tenants/{organizations,members,invites}.ts` (+ testes) | novo |
| `src/app/ai-sales/{layout,page}.tsx`, `login/`, `recuperar-senha/`, `redefinir-senha/`, `auth/callback/route.ts`, `convite/[token]/`, `selecionar-empresa/` | novo |
| `src/app/ai-sales/[org]/layout.tsx` + `dashboard/page.tsx` (vazio, estados) + `settings/membros/` | novo |
| `src/app/ai-sales/platform/` (empresas: criar/suspender; MFA obrigatório) | novo |
| `src/components/ai-sales/` (sidebar, shell, theme toggle, empty/error states) | novo |
| `src/app/globals.css` | alterar: tokens semânticos de tema escuro sob `.dark` (sem afetar o site) |
| `src/features/ai-sales/**/*.integration.test.ts` | novo: isolamento A×B, papéis, último OWNER, convite |
| `.env.example`, `docs/ai-sales/*`, `PROJETO_PERINIHUB.md` | alterar |

**Critérios de aceite:**
1. Usuário da Demo A não lê, altera nem descobre dados da Demo B (por URL,
   Server Action ou API direta do Supabase com o próprio token) — teste
   automatizado.
2. Trocar o slug na URL para empresa sem vínculo → 404.
3. Cada papel só executa o permitido (matriz testada em SQL e no DAL).
4. Não é possível remover/rebaixar o último OWNER.
5. Convite expira, é de uso único e só aceito pelo e-mail convidado.
6. Login com rate limit e erro único; cadastro público inexistente.
7. `/ai-sales/platform` exige SUPERADMIN com AAL2; ações auditadas.
8. Com `AI_SALES_ENABLED` ausente, `/ai-sales` = 404 e o site/smoke passam.
9. lint, typecheck, testes unitários, integração, build e smoke verdes.

## Fase 2 — CRM e dashboard ✅ (2026-10-29, branch `feature/ai-sales-fase-2`)

**Entregue:** migrations `20261029120000_sales_crm.sql` e
`20261029120100_sales_crm_actor_type.sql` (correção do tipo do autor nas
atividades) aplicadas no projeto "AI Sales". Telas: leads (lista com busca,
filtros e paginação; novo lead com deduplicação; ficha com etapa,
responsável, interesse, pontuação, oportunidades, tarefas, consentimento,
supressão e histórico), contatos, empresas, pipeline Kanban (arrastar ou
seletor por teclado, otimista), importação CSV, exportação CSV auditada,
configuração de etapas, origens e tags, e dashboard com indicadores reais
por período (7/30/90 dias) e "minhas tarefas".

**Testes:** 17 de integração novos (39 no total contra o banco), 21
unitários novos (198 no total: CSV, telefone, busca, ações barradas por
papel, exportação), smoke e E2E HTTP com sessão real renderizando as 15
telas do CRM (o Chrome não respondeu nesta sessão; formulários foram
cobertos pelos testes de ação e de banco, não por clique).

**Decisões e diferenças em relação ao plano:**
- Importação **síncrona** no servidor (até 2 MB / 5.000 linhas) por uma
  função do banco com o RLS do usuário; a fila do Trigger.dev entra na Fase 5
  (ADR-015).
- Exportação gerada na hora, registrada em `audit_logs` (sem tabela
  `exports` nem arquivo guardado).
- `privacy_requests` e `data_retention_policies` ficam para a Fase 8 (sem
  tela que as use agora).
- Kanban sem biblioteca e sem gráficos externos (D-15); nova dependência só
  `libphonenumber-js` (D-09).
- Vendedor com visibilidade "atribuídos" vê só os próprios leads (e
  atividades/tarefas/oportunidades deles); contatos e empresas continuam
  visíveis a todos os membros.

**Plano original da fase (referência):**

**Objetivo:** CRM utilizável internamente.
Entregas: contatos, empresas, leads, origens, tags, pipeline configurável com
Kanban, atividades, notas, tarefas, consentimento e supressão (registro e
consulta), importação CSV (worker) com deduplicação, exportação autorizada,
busca/filtros/paginação, dashboard com os indicadores de ARCHITECTURE §7 que
já têm dados (os de WhatsApp/IA aparecem "não configurado").
**Aceite:** dedupe por telefone/e-mail normalizados; importação reporta
linhas rejeitadas; consentimento separado da qualificação; SALES respeita a
visibilidade; exportação só MANAGER+ e auditada; Kanban operável por teclado;
isolamento A×B em todas as tabelas novas; estados de vazio/erro/carregamento.

## Fase 3 — WhatsApp oficial e inbox ✅ em modo simulado (2026-10-30, branch `feature/ai-sales-fase-3`)

**Entregue:** migrations `20261030120000_sales_whatsapp.sql`,
`20261030120100_sales_whatsapp_enum_casts.sql` e
`20261030120200_sales_function_privileges.sql` (correção de segurança, ver
abaixo). Webhook `/api/ai-sales/webhooks/whatsapp` (verificação GET,
assinatura `X-Hub-Signature-256` sobre o corpo bruto, deduplicação,
processamento após a resposta com `after()`), transporte isolado (Cloud API
v26.0 e simulado), gate de envio no banco, descadastro por "SAIR", status
monotônico, ecos do celular (coexistência), token no Vault, inbox com abas,
conversa com janela de 24 h, templates aprovados com variáveis, atribuição,
encerramento, simulador e tela de conexão (simulado, manual pela Cloud API,
QR Code oficial aguardando Embedded Signup).

**Testes:** 11 de integração do WhatsApp (cenários críticos 3, 4, 5, 6 e 7
do briefing), 16 de privilégios de funções, 15 unitários novos (213 no
total), E2E HTTP com webhook assinado real (falso → 401; assinado entregue
2× → 1 mensagem) e as telas de inbox, conversa e configuração.

**Incidente de segurança encontrado e corrigido (antes de produção):** as
funções criadas nas Fases 2 e 3 estavam executáveis por anônimo/logado,
porque o Postgres concede EXECUTE a PUBLIC por padrão e o
`alter default privileges in schema ...` da Fase 1 não remove esse padrão.
Mais grave: `whatsapp_get_access_token`, `whatsapp_record_inbound` e
`whatsapp_apply_status`. Nenhum token real existia e nada estava em
produção. Correção: revogação global + concessões explícitas
(migration `..._function_privileges`) e o teste permanente
`security/privileges.integration.test.ts`.

**Pendente (depende de credenciais/decisão):** cadastro por QR Code
(Embedded Signup — Tech Provider ou parceiro, D-05); configurar o webhook
no app da Meta; reprocessamento automático de eventos com falha pelo
Trigger.dev (Fase 5 — hoje os eventos falhos ficam registrados com
tentativas e dead letter); envio de template a contato sem conversa
(entra com as campanhas, Fase 5); mídia (só registro do tipo/id).

**Plano original da fase (referência):**

**Objetivo:** receber e responder mensagens com segurança.
Entregas: conexão da WABA (Vault), webhook com assinatura e dedupe, processamento
assíncrono, inbox compartilhada, atribuição, envio de texto na janela e de
template aprovado, status de entrega, sincronização de templates, opt-out,
gate de envio, modo mock completo.
**Aceite (cenários críticos 3, 5, 6, 10):** webhook duplicado = 1 mensagem;
status fora de ordem não regride; mensagem livre fora da janela é bloqueada
com motivo registrado; "SAIR" suprime e cancela pendentes; sem credenciais o
módulo mostra "não configurado" e o resto funciona; assinatura inválida = 401.
**Depende de:** D-05 para testes reais (número de teste da Meta).

## Fase 4 — Engine e agentes de IA ✅ (2026-11-01, branch `feature/ai-sales-fase-4`)

**Entregue:** migration `20261101120000_sales_agents.sql` (agentes, versões
imutáveis com rollback, execuções com custo e idempotência, ações dos
agentes, transferências, bases/documentos/trechos com busca textual em
português). Executor independente da interface (`features/ai-sales/agents/engine.ts`)
sobre o `LlmProvider` existente (agora com chave própria do AI Sales),
provedor simulado sem custo, 4 agentes: **SDR** (responde no WhatsApp pelo
gate, cita a base, transfere com confiança baixa / preço sem fonte /
limite de respostas / pedido do modelo), **classificador** (interesse e
pontuação na ficha do lead), **follow-up** e **análise** (só
recomendações). Telas: Agentes (criar por tipo, configuração, versões,
console de teste, execuções com custo e ações), Conhecimento (bases,
documentos, teste de busca), alternar IA/humano na conversa.

**Testes:** 10 de integração (SDR de ponta a ponta, cenário crítico 9,
transferência por preço sem fonte e por tentativa de injeção, isolamento do
conhecimento, teto de IA bloqueando antes da chamada, permissões), 4
unitários; total 80 de integração e 224 unitários.

**Decisões provisórias:** teto interno de IA US$ 5/mês e 4 agentes (até a
D-04); busca textual em vez de embeddings (D-06 adiada); ações dos agentes
por saída estruturada validada (sem tool use nativo), aplicadas por código.
**Pendente:** chave `AI_SALES_ANTHROPIC_API_KEY` e teto definitivo (D-04);
PDF na base de conhecimento; execução agendada do follow-up e da análise
(Fase 5).

**Plano original da fase (referência):**

**Objetivo:** agentes configuráveis por empresa, com versões, testes e custos.
Entregas: `LlmProvider.chat/embed`, executor com reserva de orçamento,
catálogo de ferramentas, agentes SDR, Captação (classificação), Follow-up
(recomendação) e Análise; versões com rollback; ambiente de teste com mock;
base de conhecimento (upload, chunking, full-text; embeddings se D-06);
handoff humano.
**Aceite (cenários 7, 9):** agente não acessa segredos nem dados de outra
empresa (teste com prompt injection); falha do provedor não duplica resposta;
resposta sobre preço/prazo sem fonte → handoff; limite de gasto bloqueia antes
da chamada; toda ação registrada em `agent_tool_calls`.
**Depende de:** D-04 (chave/orçamento), D-06 (opcional).

## Fase 5 — Automações e campanhas ✅ (2026-11-02, branch `feature/ai-sales-fase-5`)

**Entregue:** migrations `20261102120000_sales_campaigns.sql` e
`20261102120100_sales_campaign_claim_fix.sql`. Campanhas com ciclo
rascunho → aguardando aprovação → agendada → em execução → pausada →
concluída/cancelada (`campaign_transition` valida transição, papel,
aprovação por outro gestor quando existe — D-08 —, motivo obrigatório para
parar; pausa de emergência não pode ser retomada). Público com elegíveis e
excluídos com motivo (sem telefone, descadastrado, sem consentimento para a
finalidade). Despacho em lotes (máx. 20) dentro da janela de horário e dos
limites por hora/dia/total, relendo o status antes de cada envio; cada
mensagem passa pelo gate na hora. Follow-up automático por regras (dias
parado, etapas, tentativas, intervalo), com a tentativa reservada antes do
envio. Tarefas do Trigger.dev em `src/trigger/ai-sales.ts`
(reprocessamento de eventos a cada 10 min, campanhas a cada 10 min,
follow-up em dias úteis 9h–18h), inertes enquanto o AI Sales não estiver
configurado no worker. Telas de campanhas (criação, público, aprovação,
lotes, destinatários, custo estimado) e regras de follow-up.

**Defeito encontrado e corrigido:** a reserva do lote reservava mais que o
limite (`UPDATE ... WHERE id IN (SELECT ... LIMIT ... FOR UPDATE SKIP
LOCKED)` reavaliado pelo Postgres) → CTE materializada.

**Testes:** 8 de integração (cenários 4, 5 e 8, gate na hora do envio,
aprovação, limites, janela, follow-up sem repetição), 2 unitários;
total 92 de integração e 226 unitários. Uma chamada real ao Claude Haiku
validou o schema do SDR (US$ 0,00028).

**Pendente:** deploy do worker com as variáveis do AI Sales (feito pelo
usuário); envio de campanhas pela conexão Evolution continua proibido
(D-17).

**Plano original da fase (referência):**

**Objetivo:** campanhas e follow-ups autorizados, com controle total.
Entregas: ciclo de estados da campanha, audiência com elegibilidade
explicada por contato, estimativa de custo, aprovação explícita, despacho em
lotes com limites, pausa de emergência, cancelamento, follow-up por regras,
métricas de campanha.
**Aceite (cenários 4, 5, 8):** contato sem consentimento compatível ou em
supressão nunca recebe; campanha pausada não envia novos lotes (gate
reconfere no envio); agendamento não pula verificações; nenhum cron dispara
tudo de uma vez.

## Fase 6 — Captação e enriquecimento

Entregas: formulários públicos e landing pages com consentimento e evidência,
Meta Lead Ads (se configurado), pesquisa B2B em fontes permitidas (D-12),
enriquecimento com proveniência, estágios "empresa identificada → contato
encontrado → autorizado → oportunidade".
**Aceite:** telefone descoberto nunca marca autorização; toda informação tem
fonte e data; formulário com rate limit e honeypot.

## Fase 7 — Administração comercial SaaS

Entregas: painel superadmin completo (empresas, planos, entitlements, limites,
consumo, auditoria, saúde das integrações), cobrança manual, avisos de
limite.
**Aceite:** limites de plano aplicados no banco; ações de plataforma
auditadas com motivo; sem preços fictícios apresentados como definitivos.

## Fase 8 — Endurecimento e produção

Entregas: revisão de segurança completa (RLS, rotas, agentes), testes E2E dos
fluxos principais (Playwright — nova dependência a aprovar), CSP com nonce em
`/ai-sales`, retenção ativa, backups, carga básica, documentação final,
checklist de OPERATIONS §7.
**Aceite:** os 10 cenários críticos do briefing automatizados e verdes;
checklist de produção completo; autorização explícita para ativar.

---

## Matriz de riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Vazamento entre tenants por policy errada | Média | Crítico | RLS + FK composta + DAL; testes A×B em cada tabela; revisão de segurança por fase |
| Migration de teste atingir o banco de produção do portal | Alta se D-01=B | Alto | D-01 = projeto dedicado |
| Número WhatsApp bloqueado/qualidade baixa | Média | Alto | Só opt-in, limites de frequência, pausa automática por qualidade, templates bem avaliados |
| Gasto de IA descontrolado | Média | Médio | Reserva transacional, limites por agente/empresa/global, workspace separado |
| Prompt injection levando a ação indevida | Média | Alto | Entrada isolada, catálogo fechado, gate determinístico, aprovação humana |
| Mudança de regras/preços da Meta | Alta | Médio | Regras configuráveis, versão da API fixada, revisão no início das fases 3 e 5 |
| Não conformidade LGPD (base legal, retenção) | Média | Alto | Consentimento com evidência, supressão, retenção, revisão jurídica (D-10) |
| Escopo grande para um desenvolvedor | Alta | Médio | Fases pequenas, flag, uso interno primeiro |
| Plano gratuito do Supabase pausar/limitar | Média | Médio | Plano pago antes de produção (D-02) |
| Regressão no site público ou no portal | Baixa | Alto | Nada público movido; CI + smoke; worker testado inteiro antes de deploy |

## Dependências externas

| Dependência | Responsável | Necessária em |
|---|---|---|
| Projeto(s) Supabase do AI Sales | usuário (criação) | Fase 1 |
| Desativar cadastro público / ativar MFA no Auth | usuário (painel Supabase) | Fase 1 |
| Workspace + chave Anthropic do AI Sales | usuário | Fase 4 |
| Conta Meta Business verificada, app, WABA, número, token de sistema, método de pagamento | usuário | Fase 3 |
| SMTP com domínio próprio | usuário | antes de clientes externos |
| Revisão jurídica | usuário/advogado | antes de clientes externos |
| Fontes de dados B2B (chaves/termos) | usuário | Fase 6 |
