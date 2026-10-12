import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 transforma TSX com oxc (respeita "jsx": "react-jsx" do tsconfig)
  // e resolve o alias "@/*" direto do tsconfig: sem plugin-react nem
  // vite-tsconfig-paths.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
