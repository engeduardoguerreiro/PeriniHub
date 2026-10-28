// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sessão simulada do Supabase AI Sales: cada teste define quem está logado,
// de quais empresas participa e se é superadmin. Toda escrita e chamada de
// função é registrada para provar que as ações barradas não tocam no banco.
const state = vi.hoisted(() => ({
  userId: null as string | null,
  memberships: [] as { role: string; organization: { id: string; slug: string; name: string; status: string } }[],
  platformAdmin: false,
  writes: [] as unknown[],
  rpc: vi.fn(),
  serviceRpc: vi.fn(),
  rateLimitOk: true,
  signIn: vi.fn(),
}));

function query(table: string) {
  const result = () => {
    if (table === "organization_members") return { data: state.memberships, error: null };
    if (table === "platform_admins") return { data: state.platformAdmin ? { user_id: state.userId } : null, error: null };
    return { data: [], error: null };
  };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "limit"]) builder[method] = () => builder;
  for (const method of ["update", "delete", "insert"]) {
    builder[method] = (values?: unknown) => {
      state.writes.push({ table, method, values });
      return builder;
    };
  }
  builder.maybeSingle = async () => result();
  builder.single = async () => result();
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}

// Fora de uma requisição do Next, connection() lança; aqui vira no-op.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("@/lib/supabase/sales-server", () => ({
  createSalesSessionClient: async () => ({
    auth: {
      getClaims: async () => (state.userId ? { data: { claims: { sub: state.userId, email: "pessoa@teste.local" } }, error: null } : { data: null, error: null }),
      signInWithPassword: state.signIn,
      signOut: vi.fn(),
    },
    from: query,
    rpc: state.rpc,
  }),
}));
vi.mock("@/lib/supabase/sales-service", () => ({
  createSalesServiceClient: () => ({ from: query, rpc: state.serviceRpc, auth: { admin: { createUser: vi.fn() } } }),
}));
vi.mock("@/features/ai-sales/auth/rate-limit", () => ({
  clientIpHash: async () => "ip",
  emailHash: () => "email",
  consumeRateLimit: async () => state.rateLimitOk,
}));
vi.mock("@/features/ai-sales/origin", () => ({ requestOrigin: async () => "https://perinihub.com.br" }));

const settings = await import("./[org]/settings/actions");
const platform = await import("./platform/actions");
const login = await import("./login/actions");
const { proxy } = await import("@/proxy");

const ORG = { id: "11111111-1111-4111-8111-111111111111", slug: "acme", name: "Acme", status: "active" };
const OTHER_USER = "22222222-2222-4222-8222-222222222222";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.stubEnv("AI_SALES_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SALES_SUPABASE_URL", "https://salesref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key_123456");
  state.userId = null;
  state.memberships = [];
  state.platformAdmin = false;
  state.writes.length = 0;
  state.rpc.mockReset();
  state.serviceRpc.mockReset();
  state.signIn.mockReset();
  state.rateLimitOk = true;
});

describe("ações da empresa protegidas no servidor", () => {
  it("sem sessão: convidar, alterar papel e remover são recusados sem tocar no banco", async () => {
    expect(await settings.inviteMember("acme", null, form({ email: "x@y.com", role: "viewer" }))).toMatchObject({ ok: false });
    expect(await settings.changeMemberRole("acme", OTHER_USER, "admin")).toMatchObject({ ok: false });
    expect(await settings.removeMember("acme", OTHER_USER)).toMatchObject({ ok: false });
    expect(state.writes).toHaveLength(0);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("membro de outra empresa (slug trocado na URL) não age na empresa do slug", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "owner", organization: { ...ORG, slug: "outra" } }];
    expect(await settings.inviteMember("acme", null, form({ email: "x@y.com", role: "viewer" }))).toMatchObject({ ok: false });
    expect(await settings.updateOrganization("acme", null, form({ name: "Invadida", timezone: "America/Sao_Paulo", salesVisibility: "all" }))).toMatchObject({ ok: false });
    expect(state.writes).toHaveLength(0);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("vendedor e gestor não convidam nem alteram membros", async () => {
    state.userId = "u1";
    for (const role of ["sales", "manager", "viewer"]) {
      state.memberships = [{ role, organization: ORG }];
      expect(await settings.inviteMember("acme", null, form({ email: "x@y.com", role: "viewer" }))).toMatchObject({ ok: false, message: "Sem permissão para esta ação." });
      expect(await settings.setMemberStatus("acme", OTHER_USER, false)).toMatchObject({ ok: false });
    }
    expect(state.writes).toHaveLength(0);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("admin não convida nem promove a proprietário (recusado antes do banco)", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "admin", organization: ORG }];
    expect(await settings.inviteMember("acme", null, form({ email: "x@y.com", role: "owner" }))).toMatchObject({ ok: false });
    expect(await settings.changeMemberRole("acme", OTHER_USER, "owner")).toMatchObject({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.writes).toHaveLength(0);
  });

  it("admin convida: o banco recebe só o hash do token e o link volta uma vez", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "admin", organization: ORG }];
    state.rpc.mockResolvedValue({ data: "invite-id", error: null });
    const result = await settings.inviteMember("acme", null, form({ email: "Nova@Empresa.com", role: "sales" }));
    expect(result.ok).toBe(true);
    const token = result.inviteUrl?.split("/convite/")[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const args = state.rpc.mock.calls[0][1];
    expect(args).toMatchObject({ p_tenant: ORG.id, p_email: "nova@empresa.com", p_role: "sales" });
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(token);
  });

  it("empresa suspensa: nem o proprietário consegue agir", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "owner", organization: { ...ORG, status: "suspended" } }];
    expect(await settings.inviteMember("acme", null, form({ email: "x@y.com", role: "viewer" }))).toMatchObject({ ok: false });
  });

  it("entrada inválida é recusada antes do banco", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "owner", organization: ORG }];
    expect(await settings.removeMember("acme", "1; drop table")).toMatchObject({ ok: false });
    expect(await settings.changeMemberRole("acme", OTHER_USER, "deus")).toMatchObject({ ok: false });
    expect(state.writes).toHaveLength(0);
  });
});

describe("ações de plataforma", () => {
  it("usuário que não é superadmin não cria nem suspende empresas", async () => {
    state.userId = "u1";
    state.memberships = [{ role: "owner", organization: ORG }];
    expect(await platform.createOrganization(null, form({ name: "Nova", slug: "nova", ownerEmail: "a@b.com" }))).toMatchObject({ ok: false });
    expect(await platform.setOrganizationStatus(ORG.id, "suspended", "teste")).toMatchObject({ ok: false });
    expect(state.serviceRpc).not.toHaveBeenCalled();
  });

  it("superadmin precisa informar motivo para suspender e não usa identificador reservado", async () => {
    state.userId = "u1";
    state.platformAdmin = true;
    expect(await platform.setOrganizationStatus(ORG.id, "suspended", "")).toMatchObject({ ok: false });
    expect(await platform.createOrganization(null, form({ name: "Plataforma", slug: "platform", ownerEmail: "a@b.com" }))).toMatchObject({ ok: false });
    expect(state.serviceRpc).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  it("acima do limite de tentativas nem chega a consultar a senha", async () => {
    state.rateLimitOk = false;
    const result = await login.signIn({ error: null, email: "" }, form({ email: "a@b.com", password: "senha-qualquer" }));
    expect(result.error).toContain("Muitas tentativas");
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("erro de senha e conta inexistente têm a mesma mensagem", async () => {
    state.signIn.mockResolvedValue({ data: { user: null }, error: { status: 400, message: "Invalid login credentials" } });
    const result = await login.signIn({ error: null, email: "" }, form({ email: "a@b.com", password: "senha-qualquer" }));
    expect(result.error).toBe("E-mail ou senha inválidos, ou conta sem acesso ao AI Sales.");
  });
});

describe("proxy do AI Sales", () => {
  it("flag desligada: tudo em /ai-sales é 404", async () => {
    vi.stubEnv("AI_SALES_ENABLED", "false");
    for (const path of ["/ai-sales", "/ai-sales/login", "/ai-sales/acme/dashboard"]) {
      expect((await proxy(new NextRequest(`https://perinihub.com.br${path}`))).status).toBe(404);
    }
  });

  it("sem sessão: área privada redireciona ao login guardando o destino", async () => {
    const response = await proxy(new NextRequest("https://perinihub.com.br/ai-sales/acme/settings/membros"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/ai-sales/login");
    expect(location.searchParams.get("next")).toBe("/ai-sales/acme/settings/membros");
  });

  it("login, recuperação e convite continuam acessíveis sem sessão", async () => {
    for (const path of ["/ai-sales/login", "/ai-sales/recuperar-senha", "/ai-sales/convite/abc"]) {
      expect((await proxy(new NextRequest(`https://perinihub.com.br${path}`))).status).toBe(200);
    }
  });

  it("o site público e o portal não passam pelo AI Sales", async () => {
    vi.stubEnv("AI_SALES_ENABLED", "false");
    expect((await proxy(new NextRequest("https://perinihub.com.br/tech/busca"))).status).toBe(200);
  });
});
