import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Sem `globals: true`, a Testing Library não registra o cleanup sozinha.
afterEach(() => cleanup());

// Fora do Next, as APIs de cache (`cacheLife`, `cacheTag`, `revalidateTag`...)
// não têm contexto de renderização; nos testes viram no-ops observáveis.
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

// `server-only` lança erro fora do bundle de servidor do Next; nos testes é neutro.
vi.mock("server-only", () => ({}));
