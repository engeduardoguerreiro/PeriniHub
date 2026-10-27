import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Testes contra o Supabase de desenvolvimento (RLS, funções e triggers).
// Criam dados temporários e apagam no final. Uso: npm run test:integration
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
