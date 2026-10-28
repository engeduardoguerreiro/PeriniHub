# Projeto PeriniHub

Documento consolidado do site institucional PeriniHub e do portal PeriniHub Tech (operação detalhada em [`docs/tech-portal.md`](docs/tech-portal.md)).

## Resumo

A PeriniHub é a frente de tecnologia da marca Perini: criação de sites, sistemas web sob medida, painéis, integrações e automações, além dos produtos SaaS próprios (Perini Food e Perini One em operação; Perini Barber em desenvolvimento).

O site não vende serviços de engenharia elétrica. A Perini Engenharia aparece apenas como **cliente** (sistemas e presença digital feitos pela PeriniHub).

## Links

- Produção: https://perinihub.com.br (`www` e `perinihub.vercel.app` redirecionam 308)
- GitHub: https://github.com/engeduardoguerreiro/PeriniHub
- Projeto Vercel: perini/perinihub
- Branch principal: main

## Stack

- Next.js 16.4.3 (App Router, Cache Components + Partial Prefetching), React 19.2, TypeScript
- Supabase (Postgres com RLS + Auth SSR) para o portal e o painel
- Trigger.dev v4 (pipeline de notícias) e Anthropic (agentes de IA)
- Tailwind CSS v4, componentes shadcn/Base UI (só `button` e `input`)
- Lucide React
- Testes: Vitest 5 + Testing Library (jsdom), smoke test do build, GitHub Actions

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm run start       # servir o build
npm run lint
npm run typecheck
npm test            # Vitest
npm run smoke       # após o build: sobe next start e confere rotas/metadata/headers
npm run test:integration  # Supabase real (RLS, publicação, orçamento); fora do CI
npm run db:push / db:types # migrations e tipos do banco
```

O CI (`.github/workflows/ci.yml`) roda lint → typecheck → test → build → smoke em todo PR e push na main.

## Identidade visual

Baseada no logotipo azul (2026-10): símbolo hexagonal com nó central, wordmark "Perini" navy + "Hub" azul.

- Paleta (tokens em `src/app/globals.css`): `ink-950/900/800` (navy), `brand-50…700` (azul, base `#1677ff`), `aqua-300…500` (ciano do degradê do símbolo).
- Texto branco em botões usa `brand-600` (contraste AA 5,4:1); `brand-500` fica para glow e ícones.
- Títulos em **Outfit** (geométrica, próxima do lettering do logo); corpo em **Geist**.
- Hero escuro com diagrama do "hub" conectando produtos e serviços; seções claras alternadas com uma seção escura de produtos.
- Utilitários: `.text-gradient-brand`, `.bg-gradient-brand`, `.hero-glow`, `.grid-lines(-dark)`, `.ring-gradient`, `.reveal` (entrada ao rolar só com CSS, `animation-timeline: view()`).

Assets (`public/`):

- `perinihub-logo.png` — logo completo para fundo claro
- `perinihub-logo-dark.png` — variante com "Perini" em branco para fundo escuro
- `perinihub-mark.png` — só o símbolo
- `src/app/icon.png`, `apple-icon.png`, `favicon.ico` — ícone do app (tile navy)

Os assets foram recortados de `Identidade Visual PeriniHub em Azul Neon.png` com remoção de fundo por color-to-alpha. Se surgir o logo vetorial (SVG), trocar por ele.

## Estrutura

```txt
src/
├── app/
│   ├── page.tsx              # home
│   ├── clientes/page.tsx     # clientes
│   ├── not-found.tsx         # 404 em português
│   ├── layout.tsx            # fontes, metadata global, JSON-LD (ProfessionalService + WebSite)
│   ├── opengraph-image.tsx   # imagem de compartilhamento gerada no build
│   ├── robots.ts, sitemap.ts
│   └── globals.css           # tokens e utilitários
├── components/perinihub/
│   ├── header.tsx            # header fixo: transparente no hero, claro ao rolar
│   ├── mobile-menu.tsx       # menu mobile com <dialog> nativo
│   ├── hero.tsx, hub-diagram.tsx
│   ├── cards.tsx             # FeatureCard, ProductCard, ClientCard, ProcessStep
│   ├── contact-form.tsx      # formulário → WhatsApp
│   ├── footer.tsx            # inclui o botão flutuante do WhatsApp
│   └── brand.tsx, section-title.tsx, animated-section.tsx
└── lib/
    ├── site.ts               # conteúdo, contatos, produtos, helpers (wa.me, jsonLd)
    ├── quote.ts              # validação e mensagem do orçamento (funções puras)
    └── metadata.ts           # base de Open Graph compartilhada
```

Todo o conteúdo editável (textos, produtos, clientes, FAQ, contatos) fica em `src/lib/site.ts`. Produto com `href` aparece como "Em operação" (e no rodapé); sem `href`, como "Em desenvolvimento". O contador "SaaS próprios" do hero conta só os que têm `href`. Clientes podem ter `link` para o projeto no ar (sites da Perini Engenharia e do Forno Nordestino).

## PeriniHub Tech

- Portal público: `/tech` (página única com as 4 notícias mais recentes, paginada de 4 em 4 por data/hora de publicação), `/tech/[slug]`, `/tech/busca`; as antigas `/tech/categoria/*` redirecionam 308 para `/tech`, RSS em `/tech/rss.xml` e sitemap de notícias em `/tech/news-sitemap.xml`.
- Painel: `/admin/noticias` (visão geral, artigos, fontes, agentes, execuções, configurações), login em `/admin/login`.
- A home mostra "Últimas notícias de tecnologia" só quando há artigos publicados; com o banco fora do ar a seção some e o resto do site não é afetado.
- Código: `src/app/tech`, `src/app/admin`, `src/components/{tech,admin}`, `src/lib/{news,ai,security,supabase,auth,pipeline}`, `src/agents`, `src/trigger`, `supabase/migrations`.
- Arquitetura, variáveis, deploy, rollback e checklist de ativação: `docs/tech-portal.md`.

## Formulário de contato

Sem backend: valida os campos (nome, WhatsApp com DDD, tipo de projeto, mensagem até 1500 caracteres), monta a mensagem e abre `wa.me` em nova aba. Os dados não são apagados, e aparece um link "O WhatsApp não abriu?" caso o navegador bloqueie o popup. Os erros são mostrados por campo, com `aria-describedby`.

Próximo passo sugerido: endpoint `src/app/api/contact/route.ts` para também registrar o lead (e-mail via Resend ou tabela no Supabase), mantendo o WhatsApp.

## Segurança

`next.config.ts` define CSP (`'unsafe-inline'` em scripts é necessário porque o site é estático e o Next injeta scripts inline), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e COOP. Nos previews da Vercel a CSP libera `vercel.live` para a toolbar. Ao adicionar analytics ou scripts de terceiros, ajustar a CSP.

## SEO

- Canonical e `og:url` são declarados em cada página (o layout só tem o que é global, porque o merge de metadata do Next é raso).
- JSON-LD: `ProfessionalService` + `WebSite` no layout, `FAQPage` na home, sempre via `jsonLd()` (escapa `<`).
- Sitemap com `/`, `/clientes`, `/tech` e artigos publicados; sitemap de notícias separado para o Google News. `/admin` e `/api` bloqueados no robots e com `X-Robots-Tag: noindex`.

## Qualidade medida (2026-10-11, build local)

- Lighthouse mobile: Performance 95–99, Acessibilidade 100, Boas práticas 100, SEO 100. Desktop: 100 em tudo.
- axe-core: 0 violações em `/` e no 404.
- JS inicial ~204 KB gz (era ~270 KB antes de remover framer-motion e os diálogos/select da Base UI).

## Manutenção

- Não misturar com serviços de engenharia elétrica.
- Conferir mobile e desktop antes de publicar; rodar `npm test` e `npm run smoke`.
- Novas páginas: incluir no `sitemap.ts`, declarar `alternates.canonical` e `openGraph` (espalhando `sharedOpenGraph`) e adicionar uma verificação ao smoke.
- Ler `node_modules/next/dist/docs/` antes de usar APIs do Next (ver AGENTS.md).

## Pendências

- Endpoint de leads do formulário.
- Analytics (ex.: Vercel Analytics, que funciona com a CSP atual).
- Páginas próprias para os produtos.
- Logo em SVG.
- Imagem OG com a fonte Outfit (hoje usa a fonte padrão do `next/og`).
