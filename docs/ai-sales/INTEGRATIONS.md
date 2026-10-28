# PeriniHub AI Sales — Integrações

> Status de cada integração em 2026-10-28. Legenda:
> ✅ em uso no PeriniHub · 🟡 conta existe, falta configurar para o AI Sales ·
> ⛔ não configurada · 🧪 modo sandbox/mock planejado.
>
> Detalhes de API marcados com "confirmar" serão conferidos na documentação
> oficial no início da fase correspondente — nada aqui substitui essa checagem.

| Integração | Status | Fase | Bloqueia |
|---|---|---|---|
| Supabase (Postgres, Auth, Storage, Vault) | ✅ portal / 🟡 projeto "AI Sales" criado em 2026-10-28, chaves pendentes | 1 | Fase 1 |
| Trigger.dev | ✅ portal (projeto `proj_evuecjleqnmzpobbpmfy`) | 1+ | — |
| Anthropic | ✅ portal (teto US$ 5/mês compartilhado — D-04) | 4 | Fase 4 |
| Embeddings (Voyage AI ou OpenAI) | ⛔ (D-06) | 4 | só RAG semântico |
| OpenAI (geração) | ⛔ opcional | 4+ | — |
| WhatsApp Business Platform (Cloud API) | ⛔ coexistência decidida (D-05), Embedded Signup a viabilizar | 3 | Fases 3 e 5 |
| E-mail transacional (convites/recuperação) | 🟡 SMTP próprio da Hostinger decidido (nao-responda@perinihub.com.br); falta configurar no Supabase | 1 | convites por e-mail |
| Fontes de dados de empresas | ⛔ (D-12) | 6 | Fase 6 |
| Meta Lead Ads / outros anúncios | ⛔ | 6 | — |
| Gateway de pagamento | ⛔ fora do escopo atual | futura | — |

---

## 1. Supabase

- **Auth**: e-mail/senha, PKCE, TOTP. Templates de e-mail em português
  (convite, recuperação). Redirect URLs: `https://perinihub.com.br/ai-sales/auth/callback`,
  previews da Vercel e `http://localhost:3000/...` (em dev).
- **Postgres**: RLS, funções, `pgvector` (Fase 4), `pg_trgm` para busca por
  nome com erro de digitação (Fase 2).
- **Storage**: buckets privados `sales-imports`, `sales-knowledge`,
  `sales-exports`, `sales-consent-evidence`.
- **Vault**: tokens de terceiros por empresa (SECURITY §4).
- **Clientes no app**: projeto dedicado "AI Sales" (D-01): criar `sales-server.ts`/`sales-service.ts` com variáveis próprias
  (`NEXT_PUBLIC_SALES_SUPABASE_URL`, `NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY`,
  `SALES_SUPABASE_SECRET_KEY`); cookies não colidem porque o nome inclui o ref
  do projeto.
- **Tipos**: `npm run db:types` passa a gerar também o arquivo do AI Sales.

## 2. Trigger.dev

Mesmo projeto e `trigger.config.ts` do portal (D-03), tarefas em
`src/trigger/ai-sales/`. Padrões:

- Payload validado com `schemaTask` (Zod), sempre com `tenantId`.
- `idempotencyKey` em todo disparo derivado de evento externo.
- Filas: `whatsapp-send` (`concurrencyKey: tenantId`, limite por empresa),
  `agent-run` (idem), `campaign-dispatch` (lotes pequenos, agenda o próximo
  lote em vez de loop longo), `imports`, `maintenance`.
- Falha persistente (tentativas esgotadas) → status `dead_letter` na linha de
  origem + alerta no painel; reprocessamento manual.
- Cancelamento: campanhas guardam os ids de run pendentes; pausa/cancelamento
  marca o banco **e** cancela runs (`runs.cancel`); o gate de envio recusa de
  qualquer forma.

Tarefas planejadas:

| Tarefa | Gatilho | Fase |
|---|---|---|
| `ai-sales-process-whatsapp-event` | webhook | 3 |
| `ai-sales-send-message` | gate aprovou | 3 |
| `ai-sales-sync-templates` | manual + diário | 3 |
| `ai-sales-run-agent` | mensagem recebida / evento CRM / manual | 4 |
| `ai-sales-ingest-knowledge` | upload | 4 |
| `ai-sales-campaign-dispatch` | aprovação + agendamento | 5 |
| `ai-sales-followup-scan` | agendado (15 min), por tenant em lotes | 5 |
| `ai-sales-import-csv` | upload | 2 |
| `ai-sales-metrics-rollup` | horário | 2/5 |
| `ai-sales-retention` | diário | 8 |
| `ai-sales-reconcile` | horário: envios presos, webhooks não processados, reservas expiradas | 3+ |

## 3. Provedores de IA

Reaproveita `src/lib/ai/provider.ts` (interface `LlmProvider`), estendida com:

- `chat({ system, messages, tools?, schema? })` para conversas multi-turno com
  tool use e saída estruturada;
- `embed({ model, inputs })` para embeddings (D-06);
- registro de preço por modelo em tabela (como `news_agent_models`) para
  custo real por execução.

`run-agent.ts` do portal **não muda**; o AI Sales terá seu executor
(`features/ai-sales/agents/engine/`) gravando em `agent_executions` e
reservando orçamento por empresa.

Modelos iniciais sugeridos (confirmar disponibilidade e preço na Fase 4):
SDR e follow-up com `claude-sonnet-5-5`; classificação e captação com
`claude-haiku-5-5`; análise comercial com `claude-sonnet-5-5`. Configurável
por versão de agente.

**Sandbox**: `MockLlmProvider` determinístico para testes e para o "ambiente
de testes" do agente sem custo; respostas reais só quando a chave existe e o
orçamento permite.

## 4. WhatsApp Business Platform (Cloud API)

Somente a API oficial hospedada pela Meta (Graph API). Sem WhatsApp Web, sem
bibliotecas não oficiais.

### 4.1 Pré-requisitos (fora do código — responsabilidade do titular da conta)

1. Meta Business Portfolio verificado da PeriniHub (ou de cada cliente).
2. App na Meta for Developers com o produto WhatsApp.
3. WABA (WhatsApp Business Account) e número dedicado (não pode estar em uso
   no app WhatsApp comum).
4. Usuário do sistema com token permanente e permissões
   `whatsapp_business_messaging` e `whatsapp_business_management` (confirmar).
5. Webhook configurado com URL pública e verify token; app inscrito na WABA.
6. Método de pagamento na Meta (mensagens são cobradas — confirmar tabela
   vigente de preço por mensagem/categoria para o Brasil).

Para desenvolvimento, a Meta oferece **número de teste** que envia só para
poucos destinatários verificados manualmente — é o "sandbox real" sem
contatos de terceiros.

### 4.2 Uso pela plataforma

| Operação | Endpoint (Graph API, versão fixada em `WHATSAPP_GRAPH_API_VERSION` — confirmar a atual) |
|---|---|
| Enviar texto/template | `POST /{phone-number-id}/messages` |
| Listar templates | `GET /{waba-id}/message_templates` |
| Dados do número (qualidade, limite) | `GET /{phone-number-id}` |
| Inscrever app na WABA | `POST /{waba-id}/subscribed_apps` |
| Webhook | campo `messages` (mensagens recebidas e status `sent`/`delivered`/`read`/`failed`); atualizações de template e qualidade (confirmar nomes dos campos) |

Cliente HTTP próprio (`features/ai-sales/whatsapp/client.ts`): `fetch` com
timeout, respostas validadas por Zod, erros classificados (rate limit,
token inválido, destinatário inválido, fora da janela, template pausado) e
retry só para erros transitórios.

### 4.3 Regras de negócio implementadas

- Janela de atendimento de 24 h a partir da última mensagem **recebida** do
  contato: mensagem livre só dentro dela; fora, só template aprovado.
- Templates por categoria (marketing, utilidade, autenticação); só `APPROVED`;
  sincronização periódica e reação a template pausado/desativado.
- Opt-out (texto e botão de template) → supressão imediata.
- Qualidade do número e limite de mensagens exibidos no painel; queda de
  qualidade pausa campanhas automaticamente (Fase 5).
- Proibido: aquecimento artificial, rotação de números para driblar limites,
  scraping, envio a listas sem opt-in.

### 4.3.1 Coexistência (decisão D-05)

O número da PeriniHub (+55 11 97541-8690) segue no app WhatsApp Business
e é ligado à Cloud API pelo QR Code do fluxo oficial. Pontos a tratar na
Fase 3 (confirmar na documentação da Meta ao implementar):

- Embedded Signup com `featureType: whatsapp_business_app_onboarding`;
  exige app da Meta habilitado para Embedded Signup (Tech Provider) ou um
  provedor parceiro.
- Após o QR, o número fica em sincronização (`sync_pending`) e a API só
  envia quando ativo; prazo de 24 h, senão refazer a conexão.
- Mensagens enviadas pelo celular chegam pelo webhook `smb_message_echoes`
  e entram na inbox como mensagens da empresa (autor "celular").
- Histórico importado pode vir sem mídia antiga; editar e apagar mensagens
  deixa de funcionar no app.
- A desconexão é feita no próprio app (Configurações da conta), não pela API.
- Coexistência é pensada para atendimento humano + automação, não para
  alto volume: campanhas ficam com limites baixos.

### 4.4 Multiempresa

- **Fase 3**: a PeriniHub conecta a própria WABA (credenciais via tela de
  configuração, salvas no Vault). Outras empresas: conexão manual assistida
  pelo SUPERADMIN.
- **Futuro**: Embedded Signup (cada cliente conecta a própria WABA pelo fluxo
  da Meta) exige a PeriniHub ser Tech Provider/parceira — processo de
  aprovação da Meta (D-05).

### 4.5 Modo sandbox/mock

`WHATSAPP_MODE=mock` (padrão em dev/CI): `SandboxWhatsAppClient` grava as
mensagens "enviadas" e permite simular recebimentos e status pela UI de
desenvolvimento ou por teste — nada sai para a Meta. A UI exibe a faixa
"Modo simulado". Em produção, conta sem credenciais = módulo desabilitado com
aviso "WhatsApp não configurado".

## 5. Captação e enriquecimento (Fase 6)

Fontes candidatas (D-12), todas com proveniência por campo:

| Fonte | Tipo de dado | Observações |
|---|---|---|
| Formulários próprios / landing pages | lead com consentimento | melhor fonte: opt-in explícito |
| CSV do cliente | leads | importador exige declaração de origem e base legal |
| Dados abertos do CNPJ (Receita Federal) | empresas (razão social, CNAE, município, situação) | base pública grande; telefone/e-mail cadastrais podem ser de pessoa física (MEI) → **não** viram autorização de contato |
| BrasilAPI / consulta de CNPJ | enriquecimento pontual por CNPJ | respeitar limites de uso |
| Google Places API | empresas por segmento/cidade | termos restringem armazenamento de conteúdo; avaliar custo e regras antes |
| Meta Lead Ads | leads de anúncios (webhook `leadgen`) | consentimento coletado no formulário do anúncio |

Fora de escopo: scraping de sites ou redes sociais, compra de listas,
extração de números pessoais.

## 6. E-mail

Supabase envia convites e recuperação pelo SMTP próprio, que tem limite baixo
de envios por hora. Para uso com clientes, configurar SMTP próprio (ex.:
Resend, Amazon SES) com domínio `perinihub.com.br` (SPF/DKIM) — D-07.

## 7. Pagamentos (futuro)

Fora das fases atuais. `subscriptions.billing_mode = 'manual'` e
`external_ref` reservam espaço para um gateway (Stripe, Asaas, Pagar.me…)
integrado por webhook em um módulo `billing/` isolado; a lógica de
entitlements não depende do gateway.
