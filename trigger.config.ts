import { defineConfig } from "@trigger.dev/sdk";

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
});
