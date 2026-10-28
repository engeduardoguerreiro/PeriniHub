# PeriniHub AI Sales — Arquitetura

> Status: **Fase 0 (proposta)**. Nada aqui está implementado ainda. Decisões
> abertas estão em [DECISIONS.md](./DECISIONS.md) (itens `D-xx`); o que já foi
> decidido aparece como `ADR-xxx`.

Documentos relacionados: [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md) ·
[DATABASE](./DATABASE.md) · [SECURITY](./SECURITY.md) ·
[INTEGRATIONS](./INTEGRATIONS.md) · [OPERATIONS](./OPERATIONS.md) ·
[DECISIONS](./DECISIONS.md)

---

## 1. Diagnóstico do PeriniHub (auditoria de 2026-10-28)

Repositório `engeduardoguerreiro/PeriniHub`, branch `main` em `34d0ca1`,
147 arquivos versionados. Em produção em https://perinihub.com.br (Vercel).

### 1.1 Stack real (conferida em `package.json` e `npm ls`)

| Item | Versão instalada | Observação |
|---|---|---|
| Node (local e CI) | 24.21 / 24 | Trigger.dev usa `node-24` |
| Next.js | 16.4.3 | `cacheComponents: true`, `partialPrefetching: true`; `src/proxy.ts` (ex-middleware) |
| React / React DOM | 19.2.4 | |
| TypeScript | 5.9.3 | `strict: true` |
| Tailwind CSS | 4.3.0 | tokens `ink-*`, `brand-*`, `aqua-*` em `globals.css`; fontes Geist + Outfit |
| UI | shadcn 4.8.3 (só `button`, `input`, `label`, `textarea`) + `@base-ui/react` 1.5 + `lucide-react` | Poucos componentes; formulários e tabelas do painel são próprios (`components/admin/*`) |
| Supabase | `@supabase/supabase-js` 2.118, `@supabase/ssr` 0.12.7 | Clientes em `src/lib/supabase/{server,service,public}.ts`; tipos gerados em `database.types.ts` |
| Trigger.dev | SDK/CLI 4.8.1 | `trigger.config.ts`, tarefas em `src/trigger/`; projeto `proj_evuecjleqnmzpobbpmfy` |
| IA | `@anthropic-ai/sdk` 1.3.0 | Abstração `LlmProvider` em `src/lib/ai/provider.ts` (só Anthropic) |
| Validação | `zod` 4.6.7 | Usado em env, actions, schemas de IA |
| Testes | Vitest 5.0.3 + Testing Library + jsdom | 129 casos unitários; integração contra Supabase real (`npm run test:integration`) |
| CI | GitHub Actions | lint → typecheck → test → build → smoke |

**Não existem** no projeto: ORM, cliente Redis/rate limiter, biblioteca de
tabelas/gráficos, i18n, toggle de tema, OpenAI SDK, pgvector, Docker local.

### 1.2 Organização atual

```
src/
├── app/
│   ├── page.tsx, clientes/          # site institucional (estático)
│   ├── tech/                        # portal público de notícias (use cache + cacheTag)
│   ├── admin/login, admin/(painel)/noticias/*   # painel editorial (dinâmico, Supabase Auth)
│   └── api/news/revalidate/route.ts # revalidação assinada (HMAC) chamada pelo worker
├── agents/                          # agentes do portal (researcher, curator, writer...)
├── components/{perinihub,tech,admin,ui}/
├── lib/
│   ├── ai/        provider.ts (genérico), run-agent.ts (acoplado a news_*), untrusted.ts
│   ├── auth/      admin.ts (requireEditor/requireAdmin via admin_profiles)
│   ├── supabase/  clientes + tipos + teste de policies
│   ├── security/  safe-fetch (anti-SSRF), ip
│   ├── news/, pipeline/, env.ts, site.ts ...
├── trigger/       news.ts, schedule.ts
└── proxy.ts       renova sessão em /admin, guarda de slug em /tech
supabase/migrations/   3 migrations (schema news_*, seed, prioridades/imagens)
docs/tech-portal.md    operação do portal
```

### 1.3 Pontos fortes reaproveitáveis

- **Padrão de autorização** já correto: `getClaims()` valida o JWT, papel vem
  do banco via RLS, checagem em cada página/action (não só no proxy).
- **RLS com funções `security definer` + `search_path = ''`** e revogação de
  escrita direta em tabelas de log — mesmo padrão servirá ao multi-tenant.
- **Orçamento de IA transacional** (`news_start_agent_run` reserva custo antes
  da chamada) — o modelo será generalizado por tenant.
- **Defesa contra prompt injection** (`lib/ai/untrusted.ts`) e saída
  estruturada com Zod revalidada.
- **`safeFetch`** anti-SSRF para qualquer busca externa (útil em enriquecimento).
- **Env lida sob demanda** (`lib/env.ts`): o site continua no ar sem as
  credenciais — requisito "integração ausente não quebra o resto" já é cultura.
- Headers de segurança, `X-Robots-Tag` em `/admin` e `/api`, CI completo.

### 1.4 Limitações e conflitos identificados

| # | Achado | Impacto para o AI Sales |
|---|---|---|
| A1 | **Um único projeto Supabase, que é produção** (portal Tech). Não há banco de desenvolvimento nem Docker para Supabase local. | Toda migration do AI Sales cairia direto em produção. Bloqueante → **D-01**. |
| A2 | `auth.users` compartilhado com o painel editorial; `enable_signup` em produção não está documentado no repo. | Usuários de clientes conviveriam com editores; cadastro público precisa estar desligado. → **D-01**, checar no painel. |
| A3 | Teto de IA de **US$ 5/mês** na conta Anthropic é compartilhado com o portal. | Uso do AI Sales pode parar o portal (ou vice-versa). → **D-04**. |
| A4 | `run-agent.ts` grava em `news_agent_runs`; não é multi-tenant. `LlmProvider` só faz uma chamada sem histórico nem ferramentas. | Engine nova para o AI Sales reaproveitando `provider.ts`, estendido com conversa multi-turno e tool use. Portal não muda. |
| A5 | Anthropic não oferece API de embeddings. | RAG semântico exige outro provedor (Voyage AI ou OpenAI). → **D-06**. Antes disso, busca full-text do Postgres. |
| A6 | Não há toggle de tema: existe `@custom-variant dark` e a classe `.dark` no CSS, mas nada a aplica. | Modo escuro do AI Sales precisa ser implementado (escopo `/ai-sales`), sem afetar o site. |
| A7 | CSP global com `'unsafe-inline'` (necessário para o site estático). | Aceitável no início; Fase 8 avalia CSP com nonce só em `/ai-sales` (dinâmico de qualquer forma). |
| A8 | Sem rate limiter. | Login, webhooks e APIs precisam de limite → função no Postgres + Vercel Firewall (ver SECURITY). |
| A9 | `npm audit`: 1 alta (`ws` 8.17 via `trigger.dev` CLI → socket.io-client), 4 moderadas. | Só ferramenta de CLI/dev, não chega ao bundle; acompanhar atualização do `trigger.dev`. |
| A10 | Dependências defasadas sem risco conhecido (lucide 1.17→1.63, base-ui 1.5→1.9, shadcn 4.8→4.23). | Atualizar em PR separado antes da Fase 2 (UI). TypeScript 7 e ESLint 10 ficam fora. |
| A11 | Com Cache Components, ler cookies fora de `<Suspense>` é erro de build. | Todas as telas do AI Sales seguem o padrão do painel: shell estático + conteúdo autenticado em Suspense. |
| A12 | `proxy.ts` só cobre `/admin` e `/tech`. | Incluir `/ai-sales/*` (renovação de sessão) e **excluir** o webhook do WhatsApp. |

### 1.5 Compatibilidade

A stack proposta no briefing é compatível com o que existe. Ajustes:

- **Supabase Auth, RLS, Storage, Trigger.dev, Anthropic**: já em uso; reaproveitar.
- **OpenAI**: só se D-06 escolher OpenAI para embeddings, ou se um tenant pedir
  outro modelo; entra como mais um `LlmProvider`, nunca chamado direto.
- **pgvector**: disponível em todos os planos do Supabase; preferível a um
  serviço vetorial externo (ADR-008).
- **WhatsApp Cloud API**: chamada HTTP direta (`fetch` + Zod), sem SDK de
  terceiros — não há SDK oficial Node mantido pela Meta.
- **Componentes de UI**: ampliar o shadcn já configurado (`components.json`) com
  `dialog`, `dropdown-menu`, `table`, `tabs`, `select`, `sheet`, `badge`,
  `sonner`. Kanban com `@dnd-kit` (acessível com teclado), só na Fase 2.
- **Gráficos** (Fase 2): avaliar Recharts vs. SVG próprio; decidir lá.

---

## 2. Visão geral da solução

```
                Navegador (usuário do tenant)
                         │  cookie de sessão Supabase (httpOnly)
                         ▼
┌─────────────────────── Next.js 16 na Vercel ───────────────────────┐
│ /, /clientes, /tech, /admin    (inalterados)                       │
│ /ai-sales/**   Server Components + Server Actions                   │
│    └─ DAL: requireMember(org, role) → cliente com sessão (RLS)      │
│ /api/ai-sales/webhooks/whatsapp   verifica assinatura, grava        │
│                                   webhook_events, enfileira, 200    │
│ /api/ai-sales/forms/[formId]      captação pública (rate limit)     │
└───────────────┬───────────────────────────────┬────────────────────┘
                │ RLS (papel do usuário)        │ tasks.trigger (secret key do Trigger)
                ▼                               ▼
┌──────── Supabase (Postgres) ────────┐   ┌──────── Trigger.dev ─────────┐
│ organizations, members, CRM,        │◄──┤ process-whatsapp-event       │
│ consent, whatsapp, agents, campaigns│   │ run-agent (fila por tenant)  │
│ RLS por tenant_id + papel           │   │ campaign-dispatch (lotes)    │
│ funções: reserve_usage, send gate,  │   │ followup, import-csv,        │
│ audit triggers, Vault p/ segredos   │   │ metrics, retention, reconcile│
│ pgvector (knowledge_chunks)         │   └───────┬───────────┬──────────┘
└─────────────────────────────────────┘           │           │
                                                  ▼           ▼
                                    Meta WhatsApp Cloud API   Provedores de IA
                                    (Graph API, por tenant)   (via LlmProvider)
```

Princípios:

1. **O site público não muda.** O AI Sales vive em `/ai-sales` e
   `/api/ai-sales`, com layout próprio. Nenhum arquivo de `/`, `/clientes`,
   `/tech` ou `/admin` é movido (ADR-007).
2. **Banco é a última barreira.** Toda tabela de tenant tem RLS; o código também
   verifica papel, mas o RLS garante isolamento mesmo com bug no app.
3. **Webhook rápido, trabalho assíncrono.** Rotas HTTP validam, persistem e
   enfileiram; Trigger.dev faz o pesado com idempotência.
4. **IA sugere, sistema decide.** Saída de agente é proposta validada por
   schema; ações com efeito externo passam por regras determinísticas (gate de
   envio, permissões, limites) e ficam registradas.
5. **Integração ausente = recurso desabilitado com aviso**, nunca erro 500 nem
   dado simulado em produção.

---

## 3. Estrutura de diretórios proposta

Adaptação da árvore do briefing às convenções do repositório (justificativas
em ADR-007 e ADR-010):

```
src/
├── app/
│   ├── (existentes inalterados: page.tsx, clientes/, tech/, admin/, api/news/)
│   ├── ai-sales/
│   │   ├── layout.tsx                 # metadata noindex, tema, fontes já globais
│   │   ├── login/ , recuperar-senha/ , convite/[token]/ , auth/callback/route.ts
│   │   ├── selecionar-empresa/
│   │   ├── [org]/                     # slug da empresa ativa na URL (ver §4.3)
│   │   │   ├── layout.tsx             # sidebar + requireMember(org)
│   │   │   ├── dashboard/ leads/ contacts/ companies/ pipeline/
│   │   │   ├── inbox/ agents/ campaigns/ knowledge/ analytics/
│   │   │   └── settings/ (membros, integrações, consentimento, limites)
│   │   └── platform/                  # superadmin (MFA obrigatório)
│   └── api/ai-sales/
│       ├── webhooks/whatsapp/route.ts
│       ├── forms/[formId]/route.ts
│       └── exports/[id]/route.ts      # download autorizado de exportações
├── features/ai-sales/                 # domínio do produto (sem JSX de página)
│   ├── auth/        dal.ts (requireUser, requireMember, requirePlatformAdmin), roles.ts
│   ├── tenants/     organizations, members, invites, entitlements
│   ├── crm/         contacts, companies, leads, pipeline, import/, dedupe
│   ├── consent/     registro, supressão, elegibilidade (funções puras + queries)
│   ├── whatsapp/    client.ts (Graph API), signature.ts, webhook-parser.ts,
│   │                send-gate.ts, sandbox-client.ts
│   ├── agents/      engine/, tools/, prompts/, sdr.ts, followup.ts, ...
│   ├── knowledge/   ingestão, chunking, busca
│   ├── campaigns/   estado, audiência, despacho
│   ├── analytics/   métricas (definições em §7)
│   └── billing/     planos, uso, limites (sem gateway por enquanto)
├── components/ai-sales/               # UI do produto (segue components/admin)
├── lib/
│   ├── ai/          provider.ts estendido (chat + tools + embeddings) — compartilhado
│   └── supabase/    + sales-*.ts se D-01 escolher projeto dedicado
└── trigger/
    ├── news.ts, schedule.ts           # existentes
    └── ai-sales/*.ts                  # novas tarefas (mesmo trigger.config.ts)
supabase/
├── migrations/                        # se D-01 = mesmo projeto
└── (ou) supabase-sales/migrations/    # se D-01 = projeto dedicado (supabase --workdir)
docs/ai-sales/
```

Desvios em relação ao briefing:

- **Sem `(public)/`**: mover o site para um route group não muda URLs, mas
  mexe em todos os arquivos públicos sem ganho funcional. O layout raiz é
  mínimo e o AI Sales terá o próprio layout.
- **`trigger/` fica em `src/trigger/ai-sales/`**: `trigger.config.ts` já aponta
  para `./src/trigger`; um diretório na raiz exigiria mudar o deploy do portal.
- **Testes ao lado do código** (`*.test.ts`), como no resto do repositório;
  testes SQL de RLS em `supabase/tests/` (pgTAP) se D-01 permitir rodar
  `supabase test db`; caso contrário, testes de integração Vitest como
  `policies.integration.test.ts`.

---

## 4. Arquitetura multi-tenant

### 4.1 Modelo

Banco PostgreSQL compartilhado, isolamento lógico por `tenant_id`
(= `organizations.id`) + RLS (ADR-001). Um banco por empresa não se justifica
no volume previsto e multiplicaria migrations, custos e operação.

### 4.2 Papéis

| Papel | Escopo | Pode |
|---|---|---|
| SUPERADMIN | plataforma | Gerir empresas, planos, limites, saúde das integrações. **Nunca via RLS de usuário comum**: tabela `platform_admins`, ações só no servidor, MFA (AAL2) obrigatório, toda ação em `audit_logs`. Não lê conversas de tenants por padrão; acesso de suporte exige registro de motivo ("break-glass"). |
| OWNER | empresa | Tudo na empresa, inclusive transferir posse, excluir empresa, ver cobrança. Ao menos 1 OWNER por empresa (constraint). |
| ADMIN | empresa | Membros (exceto OWNER), integrações, agentes, campanhas, configurações. |
| MANAGER | empresa | CRM completo, aprovar campanhas, atribuir leads, relatórios, exportar. |
| SALES | empresa | Leads/contatos/oportunidades atribuídos (ou todos, conforme `organization_settings.sales_visibility`), inbox, tarefas. Não exporta, não aprova campanha. |
| VIEWER | empresa | Leitura. Sem conteúdo de conversas se `viewer_can_read_conversations = false`. |

Hierarquia numérica (`owner=50 … viewer=10`) permite políticas do tipo
`has_org_role(tenant_id, 'manager')` = "manager ou superior". Permissões
finas ficam em uma matriz `role → permission` em código
(`features/ai-sales/auth/roles.ts`) **e** nas policies SQL; um teste garante que
as duas não divergem.

### 4.3 Empresa ativa

- A empresa ativa vai **na URL** (`/ai-sales/[org]/...`, `org` = slug). Isso
  torna links compartilháveis, evita estado escondido em cookie e permite abas
  com empresas diferentes.
- Trocar o slug na URL **não dá acesso**: o layout chama
  `requireMember(slug)`, que resolve a organização e confere
  `organization_members` para `auth.uid()`; sem vínculo → 404 (não revela que
  a empresa existe).
- Mesmo que o código esqueça a checagem, as queries usam o cliente com sessão
  e o RLS só devolve linhas de empresas onde o usuário é membro ativo.
- Um cookie `ai_sales_last_org` guarda só a preferência de redirecionamento
  pós-login; nunca é usado para autorizar.

### 4.4 Isolamento em profundidade

1. **RLS** em todas as tabelas expostas: `using (private.is_member(tenant_id))`
   + checagem de papel por operação.
2. **Integridade entre tenants no próprio schema**: toda tabela de tenant tem
   `unique (tenant_id, id)` e as FKs filhas são compostas
   (`foreign key (tenant_id, lead_id) references leads (tenant_id, id)`) — é
   impossível ligar um lead da empresa A a um contato da empresa B, mesmo pelo
   service role (ADR-005).
3. **Jobs**: toda tarefa recebe `tenantId` no payload, e as funções de banco
   chamadas pelo worker recebem `p_tenant_id` e validam que os ids pertencem a
   ele. O worker usa service role, então a FK composta e as checagens nas
   funções são a barreira (cenário crítico 2).
4. **Storage**: buckets privados com caminho `{tenant_id}/...` e policies que
   comparam o primeiro segmento com as empresas do usuário.
5. **Busca vetorial**: função `match_knowledge_chunks(p_tenant_id, ...)`
   `security invoker` (o RLS filtra) com `tenant_id` também no `where`.

---

## 5. Mapa de rotas

| Rota | Tipo | Acesso | Fase |
|---|---|---|---|
| `/ai-sales` | redirect | logado → última empresa / seletor; anônimo → login | 1 |
| `/ai-sales/login`, `/recuperar-senha`, `/redefinir-senha` | página | pública (noindex, rate limit) | 1 |
| `/ai-sales/auth/callback` | route handler | troca de código PKCE (recuperação/convite) | 1 |
| `/ai-sales/convite/[token]` | página | pública com token de uso único | 1 |
| `/ai-sales/selecionar-empresa` | página | logado | 1 |
| `/ai-sales/[org]/dashboard` | página | VIEWER+ | 2 |
| `/ai-sales/[org]/leads`, `/leads/[id]` | página | VIEWER+ (escrita SALES+) | 2 |
| `/ai-sales/[org]/contacts`, `/companies` | página | VIEWER+ | 2 |
| `/ai-sales/[org]/pipeline` | página (Kanban) | VIEWER+ (mover SALES+) | 2 |
| `/ai-sales/[org]/inbox`, `/inbox/[conversationId]` | página | SALES+ | 3 |
| `/ai-sales/[org]/agents`, `/agents/[id]` (versões, testes) | página | MANAGER+ (editar ADMIN+) | 4 |
| `/ai-sales/[org]/knowledge` | página | MANAGER+ | 4 |
| `/ai-sales/[org]/campaigns`, `/campaigns/[id]` | página | MANAGER+ (aprovar MANAGER+, criar ADMIN/MANAGER) | 5 |
| `/ai-sales/[org]/analytics` | página | MANAGER+ | 2→5 |
| `/ai-sales/[org]/settings/*` | página | ADMIN+ (perfil próprio: todos) | 1→7 |
| `/ai-sales/platform/*` | página | SUPERADMIN + AAL2 | 1 (mínimo) → 7 |
| `/api/ai-sales/webhooks/whatsapp` | GET verificação / POST eventos | Meta (assinatura) | 3 |
| `/api/ai-sales/forms/[formId]` | POST | pública (rate limit, honeypot, consentimento explícito) | 6 |
| `/api/ai-sales/exports/[id]` | GET | quem pediu, MANAGER+, link expira | 2 |

Mutações internas usam **Server Actions** (padrão do painel); route handlers
só para chamadas externas (webhooks, formulários, downloads). Todas as rotas
`/ai-sales` e `/api/ai-sales` recebem `noindex` (metadata + `X-Robots-Tag`) e
ficam fora do `sitemap.ts`.

---

## 6. Estratégia de autenticação (resumo; detalhes em SECURITY.md)

- **Supabase Auth** com e-mail e senha (mesmo mecanismo do painel), sessão em
  cookies via `@supabase/ssr`; `proxy.ts` renova a sessão em `/ai-sales/*`.
- **DAL** em `features/ai-sales/auth/dal.ts`: `requireUser()` (getClaims),
  `requireMember(orgSlug, minRole)`, `requirePlatformAdmin()` (exige
  `aal2`). Funções com `cache()` do React por requisição.
- **Sem cadastro público** (ADR-004): contas nascem por convite de OWNER/ADMIN
  ou por criação de empresa pelo SUPERADMIN. Convite = token aleatório de 32
  bytes, guardado como hash, expira em 7 dias, uso único, preso ao e-mail.
- **Recuperação de senha** pelo fluxo PKCE do Supabase com redirect só para
  URLs permitidas.
- **Abuso**: limites do Supabase Auth + limite próprio por IP/e-mail no Server
  Action de login; mensagem de erro única (não revela contas).
- **MFA**: TOTP do Supabase. Obrigatório para SUPERADMIN desde a Fase 1;
  opcional e depois exigível por empresa (`organization_settings.require_mfa`).
- **Separação do painel editorial**: papéis do AI Sales não dão acesso a
  `/admin` e vice-versa (tabelas diferentes: `admin_profiles` ×
  `organization_members` / `platform_admins`).

---

## 7. Indicadores do dashboard (definições)

Todos calculados por `tenant_id`, no período `[início, fim)` em UTC convertido
do fuso da empresa (`organization_settings.timezone`, padrão
`America/Sao_Paulo`), respeitando o RLS do usuário (SALES com visibilidade
"atribuídos" vê só os seus). Sem dados no período → "—", nunca zero inventado.

| Indicador | Definição |
|---|---|
| Leads cadastrados | `count(leads)` com `created_at` no período e `deleted_at is null` |
| Leads por origem | mesmo conjunto agrupado por `lead_source_id` |
| Leads autorizados para contato | leads cujo contato tem `consent_records` vigente (`status='granted'`, não revogado, não expirado) para canal `whatsapp` e qualquer finalidade, e não está em `suppression_list` — **na data de fim do período** |
| Conversas iniciadas | `count(conversations)` com `started_at` no período |
| Respostas recebidas | `count(distinct conversation_id)` com ao menos uma `messages.direction='inbound'` no período, em conversas que tiveram mensagem `outbound` iniciada pela empresa antes |
| Leads qualificados | leads que entraram em estágio com `pipeline_stages.is_qualified = true` no período (via `activities` de mudança de estágio) |
| Oportunidades abertas | `count(opportunities)` com `status='open'` na data de fim |
| Taxa de conversão | `ganhas no período / (ganhas + perdidas no período)`; denominador 0 → "—" |
| Tempo de primeira resposta | mediana de `first_outbound_at - first_inbound_at` por conversa iniciada pelo contato no período (separado por humano e IA) |
| Atendimento humano × IA | `count(messages outbound)` por `sender_type in ('user','agent')` |
| Custo de IA | `sum(agent_executions.cost_usd)` no período (custo real informado pelo provedor; reservas não contam) |
| Custo de WhatsApp | `sum(message_delivery_events.pricing_amount)` quando a Meta informa preço no webhook; senão estimativa marcada como **estimada** pela tabela de preços configurada |
| Custo por oportunidade | `(custo IA + custo WhatsApp) / oportunidades criadas no período` |
| Campanhas em andamento | `count(campaigns)` com `status in ('scheduled','running','paused')` na data de fim |
