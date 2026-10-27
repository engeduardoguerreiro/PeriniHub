# PeriniHub Tech — operação

Portal de notícias de tecnologia (`/tech`) com redação assistida por IA e
painel editorial (`/admin/noticias`), acoplado ao site institucional sem
mudar a área comercial.

## Arquitetura

```
Feeds RSS/Atom oficiais (news_sources)
        │  safeFetch: só http(s) público, IP checado na conexão, 10 MB, 20 s, 3 redirects
        ▼
Trigger.dev (worker na nuvem, independente do computador local e da Vercel)
  news-scheduler (*/15 min, America/Sao_Paulo) — lê horários e pausa do painel
    ├─ fetch-news-sources ─ deduplicate-news ─ classify-news
    │     └─ generate-article ─ verify-article ─ prepare-article-seo
    ├─ publish-approved-article (agendados / automático)
    └─ recuperação: elegíveis parados voltam à fila; 3 falhas → dead letter
  daily-news-report (20h)
        │  secret key (service_role) — só no worker
        ▼
Supabase Postgres
  RLS: público lê só artigos publicados; escrita exige papel admin/editor
  news_publish_article(): aprovação + verificação + limite diário + idempotência
  news_start_agent_run(): reserva de orçamento antes de cada chamada de IA
  triggers: auditoria de toda alteração, guarda de status
        ▲                                   │
        │ sessão SSR (@supabase/ssr)        │ POST /api/news/revalidate (HMAC, 5 min)
Next.js 16 na Vercel                        ▼
  /tech/** — Server Components, use cache + cacheTag, shell estático (PPR)
  /admin/** — dinâmico, proxy renova sessão, papel conferido em cada página/ação
```

### Agentes

| Agente | Implementação | Modelo padrão | Observações |
|---|---|---|---|
| Researcher | determinístico (`src/agents/researcher.ts`) | — | Só feeds cadastrados; sem scraping. |
| Curator | `src/agents/curator.ts` | `claude-haiku-5-5` | Dedup sem IA (URL canônica, fingerprint, Jaccard) + nota 0–100 em lote. Elegibilidade é regra fixa (nota mínima, categorias). |
| Writer | `src/agents/writer.ts` | `claude-sonnet-5-5` | Estrutura fixa montada em código; links e HTML removidos; detector de cópia literal. |
| Fact Checker | `src/agents/fact-checker.ts` | `claude-sonnet-5-5` | O modelo só propõe; cada citação é conferida literalmente na fonte. Sem evidência → bloqueado. Versões/anos sem fonte → bloqueado. |
| SEO Editor | `src/agents/seo-editor.ts` | `claude-haiku-5-5` | Slug, metadados, links internos só de lista; anti-sensacionalismo. Capas são geradas pelo site (sem imagens de terceiros). |
| Publisher | `src/agents/publisher.ts` | — | Chama `news_publish_article` e pede revalidação assinada ao site. |

Custo medido (2026-10-27): **~US$ 0,05 por artigo** (curadoria + redação +
verificação + SEO). Com o limite padrão de 3 publicações/dia a redação fica em
3 artigos/dia (≈ US$ 4,60/mês), abaixo do teto de US$ 5. O teto é aplicado
pela função do banco **antes** de cada chamada e também, de forma
independente, pelo limite de gasto do workspace na Anthropic.

## Variáveis de ambiente

Nomes e descrições em `.env.example`. Onde cada uma vive:

| Variável | Local (`.env.local`) | Vercel | Trigger.dev |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ (Preview e Production) | ✓ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_SECRET_KEY` | ✓ | — (não precisa) | ✓ |
| `SUPABASE_DB_URL` | ✓ (migrations) | — | — |
| `TRIGGER_SECRET_KEY` | `tr_dev_…` | `tr_prod_…` em Production | — |
| `TRIGGER_PROJECT_REF` | ✓ | — | — (fixo em `trigger.config.ts`) |
| `ANTHROPIC_API_KEY` | ✓ | — | ✓ |
| `NEWS_MONTHLY_COST_LIMIT_USD` | ✓ | — | ✓ (referência; o teto efetivo é o do painel) |
| `NEWS_SITE_URL` | `http://localhost:3000` | — | URL do site daquele ambiente |
| `NEWS_REVALIDATE_SECRET` | ✓ | ✓ (mesmo valor do worker) | ✓ |

A secret key do Supabase e a chave da Anthropic **nunca** vão para a Vercel:
o site só lê dados públicos (RLS) e usa a sessão do editor no painel.

## Desenvolvimento local

```bash
npm ci
npm run db:push            # aplica migrations pendentes (SUPABASE_DB_URL)
npm run db:types           # regenera src/lib/supabase/database.types.ts
npm run dev                # site em http://localhost:3000
npx trigger.dev@4.8.1 dev  # worker local ligado ao ambiente DEV do Trigger.dev
```

Qualidade:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run smoke
npm run test:integration   # Supabase real: RLS, publicação, orçamento (cria e apaga dados de teste)
```

## Banco (Supabase)

- Migrations em `supabase/migrations/` (aditivas; nenhuma destrutiva).
- Papéis: tabela `admin_profiles` (`admin` | `editor`). Para dar acesso a
  alguém: criar o usuário em Authentication → Users e inserir a linha com o
  papel. Cadastro público fica **desligado** no Supabase.
- Ambientes: hoje há um único projeto Supabase (dev/preview). Antes de ativar
  em produção, decidir entre (a) promovê-lo a produção, limpando dados de
  teste, ou (b) criar um projeto de produção e rodar `npm run db:push` nele.
  Testes nunca publicam porque a publicação exige aprovação e o worker de
  desenvolvimento usa o ambiente DEV do Trigger.dev.

## Deploy

### Worker (Trigger.dev)

1. `npx trigger.dev@4.8.1 login` (uma vez por máquina).
2. Implantar com as variáveis carregadas no shell: o `syncEnvVars` do
   `trigger.config.ts` copia as variáveis da coluna Trigger.dev para o
   ambiente **Production** (chaves como segredo; `NEWS_SITE_URL` fixo em
   `https://perinihub.com.br`). O deploy falha se faltar alguma.
   ```bash
   set -a && . ./.env.local && set +a && npx trigger.dev@4.8.1 deploy
   ```
3. Conferir em Runs que o `news-scheduler` roda a cada 15 minutos.

Agendamentos declarativos só disparam no ambiente onde a versão está
implantada. Horários de coleta são editados no painel (padrão 06:00, 12:00 e
17:00, horário de Brasília); o agendador roda de 15 em 15 minutos e usa
chaves de idempotência por data e horário.

### Site (Vercel)

1. Variáveis da coluna Vercel em Project Settings → Environment Variables
   (Preview e Production).
2. Preview: `npx vercel deploy` (a Vercel deste projeto não gera previews
   automáticos por branch).
3. Produção: merge na `main` (deploy automático) **somente com aprovação**.

## Rollback

| Situação | Ação |
|---|---|
| Artigo com problema | Painel → artigo → **Retirar do ar** (sai do cache na hora). |
| Pipeline se comportando mal | Painel → **Pausar automações** (coleta, IA e publicação automática param; o banco recusa novas execuções). |
| Gasto inesperado | Pausar; baixar o teto em Configurações; o limite do workspace na Anthropic é a segunda trava. |
| Versão do worker com bug | Trigger.dev → Deployments → promover a versão anterior. |
| Versão do site com bug | Vercel → Deployments → *Promote* / *Instant Rollback* do deploy anterior. |
| Desligar o portal inteiro | Reverter o merge na `main`. As tabelas `news_*` podem ficar; nada do site institucional depende delas (a seção da home some sem artigos). |

## Checklist de ativação da automação

- [ ] Migrations aplicadas no Supabase de produção e `contato@perinihub.com.br` com papel `admin`.
- [ ] Cadastro público desligado e URLs de redirect configuradas no Supabase Auth.
- [ ] Limite de gasto mensal no workspace da Anthropic (US$ 5).
- [ ] Variáveis cadastradas na Vercel (Production) e no Trigger.dev (Production), com o mesmo `NEWS_REVALIDATE_SECRET`.
- [ ] Worker implantado (`trigger.dev deploy`) e `news-scheduler` executando.
- [ ] Site em produção com `/tech`, `/tech/rss.xml`, `/tech/news-sitemap.xml` e `/admin/login` respondendo.
- [ ] Primeira coleta manual ("Executar pesquisa agora") e primeiro artigo revisado e publicado à mão.
- [ ] Sitemap de notícias enviado no Google Search Console.
- [ ] Depois de algumas semanas de revisão manual, decidir se liga a publicação automática (Configurações). Mantê-la desligada é o padrão seguro.
