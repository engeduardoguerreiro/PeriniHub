import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

// Variáveis que o worker precisa em produção. No deploy elas são lidas do
// ambiente de quem implanta (carregue o .env.local antes) e enviadas ao
// Trigger.dev como segredos — nada disso fica no código.
const WORKER_ENV = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", secret: false },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", secret: false },
  { name: "SUPABASE_SECRET_KEY", secret: true },
  { name: "ANTHROPIC_API_KEY", secret: true },
  { name: "NEWS_REVALIDATE_SECRET", secret: true },
  { name: "NEWS_MONTHLY_COST_LIMIT_USD", secret: false },
] as const;

// AI Sales: enviadas só quando presentes no ambiente de quem implanta. Sem
// elas, as tarefas do AI Sales ficam inertes e o deploy do portal segue normal.
const OPTIONAL_AI_SALES_ENV = [
  { name: "AI_SALES_ENABLED", secret: false },
  { name: "NEXT_PUBLIC_SALES_SUPABASE_URL", secret: false },
  { name: "NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY", secret: false },
  { name: "SALES_SUPABASE_SECRET_KEY", secret: true },
  { name: "AI_SALES_ANTHROPIC_API_KEY", secret: true },
  { name: "WHATSAPP_GRAPH_API_VERSION", secret: false },
  { name: "EVOLUTION_API_URL", secret: false },
  { name: "EVOLUTION_API_KEY", secret: true },
] as const;

const PRODUCTION_SITE_URL = "https://perinihub.com.br";

// Worker do PeriniHub Tech (pipeline de notícias). Roda na nuvem do
// Trigger.dev, independente do computador local e da Vercel.
export default defineConfig({
  // Referência pública do projeto (não é segredo).
  project: "proj_evuecjleqnmzpobbpmfy",
  dirs: ["./src/trigger"],
  runtime: "node-24",
  // Teto padrão por execução; cada tarefa define o seu (máx. 10 min).
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 120_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      syncEnvVars(({ environment }) => {
        // Em dev o CLI lê o .env.local diretamente; só ambientes implantados recebem a cópia.
        if (environment !== "prod") return;
        const missing = WORKER_ENV.filter(({ name }) => !process.env[name]);
        if (missing.length > 0) {
          throw new Error(`Deploy sem variáveis obrigatórias: ${missing.map(({ name }) => name).join(", ")}`);
        }
        return [
          ...WORKER_ENV.map(({ name, secret }) => ({ name, value: process.env[name] as string, isSecret: secret })),
          ...OPTIONAL_AI_SALES_ENV.filter(({ name }) => process.env[name]).map(({ name, secret }) => ({ name, value: process.env[name] as string, isSecret: secret })),
          { name: "NEWS_SITE_URL", value: PRODUCTION_SITE_URL },
        ];
      }),
    ],
  },
});
