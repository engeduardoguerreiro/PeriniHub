// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sessão simulada: cada teste define quem está logado e com qual papel.
const session = vi.hoisted(() => ({ userId: null as string | null, role: null as "admin" | "editor" | null, rpc: vi.fn(), updates: [] as unknown[] }));

vi.mock("@/lib/supabase/server", () => ({
  createSessionClient: async () => ({
    auth: {
      getClaims: async () =>
        session.userId ? { data: { claims: { sub: session.userId, email: "editor@teste.local" } }, error: null } : { data: null, error: null },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "admin_profiles" && session.role ? { role: session.role } : null, error: null }),
          single: async () => ({ data: null, error: { message: "not found" } }),
        }),
      }),
      update: (values: unknown) => {
        session.updates.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
    rpc: session.rpc,
  }),
}));
vi.mock("@/lib/pipeline/dispatch", () => ({ dispatchResearch: vi.fn(), dispatchGenerate: vi.fn(), dispatchVerify: vi.fn() }));

const actions = await import("./(painel)/noticias/actions");
const { proxy } = await import("@/proxy");

function isRedirectTo(error: unknown, path: string) {
  const digest = (error as { digest?: string })?.digest ?? "";
  return digest.startsWith("NEXT_REDIRECT") && digest.includes(path);
}

beforeEach(() => {
  session.userId = null;
  session.role = null;
  session.rpc.mockReset();
  session.updates.length = 0;
});

describe("Server Actions protegidas no servidor", () => {
  const ARTICLE = "8a4c2f5e-1b2d-4c3e-9f00-1234567890ab";

  it("sem sessão: publicar redireciona ao login e não toca no banco", async () => {
    const error = await actions.publishArticleNow(ARTICLE).catch((e) => e);
    expect(isRedirectTo(error, "/admin/login")).toBe(true);
    expect(session.rpc).not.toHaveBeenCalled();
  });

  it("logado sem papel editorial: também é barrado", async () => {
    session.userId = "u1";
    const error = await actions.approveArticle(ARTICLE).catch((e) => e);
    expect(isRedirectTo(error, "/admin/login")).toBe(true);
    expect(session.updates).toHaveLength(0);
  });

  it("editor não altera configurações nem pausa automações (só admin)", async () => {
    session.userId = "u1";
    session.role = "editor";
    for (const call of [() => actions.setAutomationPaused(true), () => actions.setSourceEnabled(ARTICLE, false)]) {
      const error = await call().catch((e) => e);
      expect(isRedirectTo(error, "erro=permissao")).toBe(true);
    }
    expect(session.updates).toHaveLength(0);
  });

  it("editor publica pela função do banco, que aplica as regras editoriais", async () => {
    session.userId = "u1";
    session.role = "editor";
    session.rpc.mockResolvedValue({ data: null, error: { message: "not_approved" } });
    const result = await actions.publishArticleNow(ARTICLE);
    expect(session.rpc).toHaveBeenCalledWith("news_publish_article", { p_article_id: ARTICLE, p_mode: "manual" });
    expect(result).toEqual({ ok: false, message: "O artigo precisa estar aprovado ou agendado." });
  });

  it("entrada inválida é recusada antes do banco", async () => {
    session.userId = "u1";
    session.role = "admin";
    expect(await actions.publishArticleNow("1; drop table")).toMatchObject({ ok: false });
    expect(session.rpc).not.toHaveBeenCalled();
  });
});

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key_123456");
  });

  it("painel sem cookie de sessão: 307 para o login", async () => {
    const response = await proxy(new NextRequest("https://perinihub.com.br/admin/noticias/artigos"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://perinihub.com.br/admin/login");
  });

  it("a página de login continua acessível", async () => {
    const response = await proxy(new NextRequest("https://perinihub.com.br/admin/login"));
    expect(response.status).toBe(200);
  });

  it("slug com maiúsculas/acentos redireciona 308 para o canônico; slug malformado é 404", async () => {
    const redirect = await proxy(new NextRequest("https://perinihub.com.br/tech/Not%C3%ADcia-Teste"));
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("location")).toBe("https://perinihub.com.br/tech/noticia-teste");
    const missing = await proxy(new NextRequest("https://perinihub.com.br/tech/%E0%A4%A"));
    expect(missing.status).toBe(404);
  });

  it("rotas do portal com slug válido seguem normalmente", async () => {
    for (const path of ["/tech/nodejs-24", "/tech/busca", "/tech/categoria/dados"]) {
      expect((await proxy(new NextRequest(`https://perinihub.com.br${path}`))).status).toBe(200);
    }
  });
});
