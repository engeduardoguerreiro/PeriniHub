# PeriniHub AI Sales — Decisões

Registro de decisões de arquitetura (ADR) e de decisões pendentes do
responsável pelo produto. ADRs com status **Proposta** passam a **Aceita**
quando a Fase 1 for autorizada sem objeção a elas. Em 2026-10-28 a Fase 1
foi autorizada: ADR-001 a ADR-011 estão **aceitas** (ADR-012 a 014 valem a
partir das fases 3–4).

---

## Decisões pendentes

### Decididas em 2026-10-28

| Id | Decisão |
|---|---|
| D-01 | **(A) Projeto Supabase dedicado** — criado pelo usuário com o nome "AI Sales". Migrations em `supabase-sales/`. |
| D-02 | Plano gratuito para desenvolvimento; plano de produção decidido na Fase 8 (região a conferir pelo host do pooler). |
| D-03 | **Mesmo projeto Trigger.dev** do portal, filas separadas. |
| D-13 | Visibilidade do SALES **configurável por empresa**, padrão "todos". |
| D-14 | Primeiras empresas (tenants): **PeriniHub, PeriniFood e Perini Engenharia**, para atender os respectivos clientes. |
| D-09 | **Aceita**: `libphonenumber-js` (metadados "min") para telefones em E.164. |
| D-15 | **Decidida**: Kanban com arrastar nativo + seletor por teclado; barras do dashboard em CSS. Sem biblioteca de gráficos por enquanto. |
| D-05 | **WhatsApp oficial (Cloud API) por coexistência** (2026-10-29): o número **+55 11 97541-8690** continua no app WhatsApp Business e é conectado à API escaneando um QR Code no fluxo oficial da Meta (Embedded Signup, `featureType: whatsapp_business_app_onboarding`). O usuário pediu QR Code; a conexão não oficial (WhatsApp Web/Baileys) foi descartada por violar as regras 7 e 8 do briefing e arriscar o banimento do número. Pendente: viabilizar o Embedded Signup (PeriniHub como Tech Provider, com verificação da empresa e revisão do app, ou por um provedor parceiro como a 360dialog). Até lá, a Fase 3 é construída em modo simulado. |
| D-07 | **SMTP próprio na Hostinger**, remetente **nao-responda@perinihub.com.br** (caixa a criar). Domínio já tem MX, SPF, DKIM (`hostingermail-a`) e DMARC `p=none` (conferido em 2026-10-29). Configuração do SMTP no Supabase Auth feita pelo usuário (senha não passa pelo agente). |
| D-17 | **Oficial + Evolution** (2026-10-31, pedido do usuário após ver custos da Meta): além da Cloud API, conexão **não oficial** pela Evolution API (mesmo servidor do PeriniFood), revogando as regras 7 e 8 do briefing **só** para este uso. Limites no banco (`whatsapp_send_gate`): respostas na janela normais; proativo só manual, com consentimento, ≤ 2 por contato em 7 dias e limite diário por número (padrão 10, máx. 30); campanhas, follow-up e agentes não iniciam conversa por Evolution; sem templates. Usuário quer começar com poucos clientes por dia para evitar banimento. Não usar o mesmo número na Evolution e na coexistência oficial. |
| D-16 | **MFA do superadmin adiado** (pedido do usuário). Exigência implementada atrás de `AI_SALES_PLATFORM_REQUIRE_MFA` (padrão `false`); o painel mostra aviso. Ativar TOTP no Supabase e ligar a flag antes de atender clientes externos. Superadmin: `contato@perinihub.com.br`. |

### Histórico das opções (antes da Fase 1)

**D-01 — Onde fica o banco do AI Sales**
- Situação: o único projeto Supabase é **produção** (portal Tech). Não há
  banco de desenvolvimento nem Docker para Supabase local.
- Opções:
  - **(A) Projeto Supabase dedicado ao AI Sales** — um de desenvolvimento já,
    e o de produção na Fase 8. Isola dados pessoais de clientes do portal,
    separa `auth.users`, backups e retenção, e nenhuma migration em teste toca
    produção. Custo: o plano gratuito permite 2 projetos ativos por
    organização e pausa projetos inativos; produção real pede plano pago.
  - (B) Mesmo projeto, schema `sales`. Sem custo novo, mas cada migration de
    desenvolvimento roda no banco de produção do portal, e usuários de
    clientes dividem `auth.users` com editores.
  - (C) Instalar Docker e usar Supabase local para dev, mantendo (A) ou (B)
    para produção.
- **Recomendação: (A)**, com (C) opcional para testes offline. Ação do
  usuário: criar o projeto (região São Paulo) e informar URL e chaves no
  `.env.local`.

**D-02 — Plano e região do Supabase do AI Sales**
- Produção com dados de clientes pede: sem pausa por inatividade, backups
  diários/PITR, proteção contra senhas vazadas. Isso define o plano.
- Recomendação: dev no plano gratuito agora; decidir o plano de produção na
  Fase 8. Região `sa-east-1` (São Paulo) pela LGPD e latência.

**D-03 — Projeto Trigger.dev**
- Recomendação: **mesmo projeto e worker** do portal, filas separadas. Um
  projeto à parte isolaria deploys, mas duplica configuração.
- Consequência: deploy do worker publica as tarefas dos dois produtos juntas.

**D-13 — Visibilidade padrão do papel SALES**
- Opções: vê todos os leads da empresa / só os atribuídos a ele.
- Recomendação: configurável por empresa, padrão **"todos"** no uso interno.

### Antes das fases seguintes

| Id | Decisão | Fase | Recomendação |
|---|---|---|---|
| D-04 | (provisório: em 2026-11-02 o usuário pediu para usar **a mesma chave Anthropic do portal Tech** por enquanto — copiada para `AI_SALES_ANTHROPIC_API_KEY` no `.env.local`; teto interno US$ 5/mês por empresa. Atenção: o limite de gasto do workspace Anthropic passa a ser compartilhado com o portal) Orçamento de IA do AI Sales: workspace e chave Anthropic separados do portal (o teto atual de US$ 5/mês é compartilhado), valores de limite global e por empresa | 4 | Workspace próprio "ai-sales" com limite de gasto; limite interno inicial a definir pelo usuário |
| D-06 | Embeddings para RAG: Voyage AI, OpenAI ou adiar | 4 | Começar com full-text do Postgres; adicionar embeddings só se a qualidade das buscas exigir |
| D-08 | Aprovação de campanha por pessoa diferente de quem criou | 5 | Exigir quando a empresa tem 2+ MANAGER/ADMIN; senão, confirmação explícita com motivo |
| D-10 | Revisão jurídica: termos, política de privacidade, contrato de operador, prazos de retenção | 8 (antes do 1º cliente externo) | Contratar revisão |
| D-11 | Captcha (Cloudflare Turnstile) nos formulários públicos | 6 | Só se houver abuso; CSP precisa liberar o domínio |
| D-12 | Fontes de dados para captação B2B (dados abertos CNPJ, BrasilAPI, Google Places...) | 6 | Começar por dados abertos do CNPJ + formulários próprios |

---

## ADRs

### ADR-001 — Multi-tenant em banco compartilhado com `tenant_id` + RLS
**Status:** Proposta. **Contexto:** briefing recomenda; volume inicial baixo.
**Decisão:** um banco, coluna `tenant_id` em toda tabela de empresa, RLS em
todas as tabelas expostas. **Consequência:** isolamento depende de RLS
correto → testes automáticos de isolamento são obrigatórios em toda fase.

### ADR-002 — AI Sales dentro do app Next existente, em `/ai-sales`
**Status:** Proposta. **Decisão:** mesmo projeto Vercel e domínio; sem app ou
subdomínio separado por enquanto. **Consequência:** compartilha CSP, build e
CI com o site; isolamento por layout, flag `AI_SALES_ENABLED` e `noindex`.
Migrar para `app.perinihub.com.br` depois continua possível.

### ADR-003 — Supabase Auth
**Status:** Proposta. Já usado no painel, integra com RLS (`auth.uid()`),
oferece TOTP, PKCE e convites.

### ADR-004 — Sem cadastro público de empresas
**Status:** Proposta. Contas por convite; empresas criadas pelo SUPERADMIN
até existir fluxo comercial e de cobrança.

### ADR-005 — FKs compostas `(tenant_id, id)` para integridade entre tenants
**Status:** Proposta. Toda tabela de tenant tem `unique (tenant_id, id)` e
referências entre tabelas de tenant usam FK composta. Impede relações
cruzadas até para o service role (jobs). Custo: colunas `tenant_id`
redundantes nas filhas — aceitável.

### ADR-006 — Segredos de terceiros por empresa no Supabase Vault
**Status:** Proposta. Tokens da Meta ficam criptografados no Vault, lidos só
por função executável pelo `service_role`. Alternativa descartada: cifrar no
app com chave em env (mais código próprio de criptografia).

### ADR-007 — Não mover o site público para um route group `(public)`
**Status:** Proposta. Route groups não mudam URLs; mover todos os arquivos
públicos não traz ganho e arrisca regressões de SEO/smoke. O AI Sales tem
layout próprio sob `/ai-sales`.

### ADR-008 — pgvector no próprio Supabase; full-text primeiro
**Status:** Proposta. Evita outro serviço com dados de clientes; isolamento
pelo mesmo RLS. Busca semântica entra quando D-06 for decidida.

### ADR-009 — Empresa ativa na URL (`/ai-sales/[org]`)
**Status:** Proposta. Autorização sempre por vínculo em
`organization_members`; cookie só como preferência de redirecionamento.

### ADR-010 — Código de domínio em `src/features/ai-sales/`, tarefas em `src/trigger/ai-sales/`
**Status:** Proposta. Agrupa o novo produto (grande) sem misturar com
`src/lib` do portal; mantém `trigger.config.ts` intacto.

### ADR-011 — Feature flag `AI_SALES_ENABLED`
**Status:** Proposta. Permite merges na `main` sem expor o produto; ausência
de configuração desliga o módulo sem afetar o site.

### ADR-012 — Cliente HTTP próprio para a Cloud API, com modo mock padrão
**Status:** Proposta. Sem SDK de terceiros; `WHATSAPP_MODE=mock` em dev/CI.

### ADR-013 — IA sugere, sistema executa
**Status:** Proposta. Saídas de agentes são propostas validadas por schema;
efeitos passam por catálogo fechado de ferramentas, gate de envio e
permissões, com registro em `agent_tool_calls`.

### ADR-014 — Engine de agentes nova, reaproveitando só o provedor
**Status:** Proposta. `run-agent.ts` do portal continua como está; o AI Sales
ganha executor multi-tenant próprio sobre `LlmProvider` estendido.

### ADR-015 — Importação CSV síncrona até a Fase 5
**Status:** Aceita. Arquivos de até 2 MB / 5.000 linhas são validados no
servidor (Zod + libphonenumber) e gravados por `import_contacts`, função do
banco que roda com o RLS do usuário e deduplica por telefone/e-mail.
Arquivos maiores e reprocessamento ficam para a fila do Trigger.dev (Fase 5).
