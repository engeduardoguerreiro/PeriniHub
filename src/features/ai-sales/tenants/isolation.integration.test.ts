import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/sales.types";

import { generateInviteToken } from "./tokens";

// Integração real com o Supabase "AI Sales" (desenvolvimento): isolamento
// entre empresas, papéis, convites, guarda de OWNER, auditoria, consumo e
// limite de tentativas. Tudo que é criado aqui é apagado no afterAll.

type Db = SupabaseClient<Database>;
type Role = Database["public"]["Enums"]["org_role"];

const url = process.env.NEXT_PUBLIC_SALES_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SALES_SUPABASE_SECRET_KEY!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

const service: Db = createClient<Database>(url, secret, options);
const anon: Db = createClient<Database>(url, publishable, options);

const runTag = randomBytes(4).toString("hex");
const userIds: string[] = [];
const orgIds: string[] = [];

type TestUser = { id: string; email: string; client: Db };

async function createUser(label: string): Promise<TestUser> {
  const email = `zz-teste-${label}-${runTag}@teste.perinihub.local`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const client = createClient<Database>(url, publishable, options);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

/** Cria a empresa pela função de plataforma e faz o dono aceitar o convite. */
async function createOrg(label: string, actor: TestUser, owner: TestUser) {
  const { token, hash } = generateInviteToken();
  const { data: id, error } = await service.rpc("platform_create_organization", {
    p_actor: actor.id,
    p_name: `[TESTE] Empresa ${label}`,
    p_slug: `zz-${label}-${runTag}`,
    p_owner_email: owner.email,
    p_owner_token_hash: hash,
    p_reason: "teste de integração",
  });
  if (error) throw error;
  orgIds.push(id);
  const accepted = await owner.client.rpc("accept_invite", { p_token_hash: hash });
  if (accepted.error) throw accepted.error;
  return { id, slug: accepted.data, token };
}

/** Convida pelo owner/admin e aceita com o usuário convidado. */
async function addMember(tenant: string, by: TestUser, member: TestUser, role: Role) {
  const { hash } = generateInviteToken();
  const invite = await by.client.rpc("create_invite", { p_tenant: tenant, p_email: member.email, p_role: role, p_token_hash: hash });
  if (invite.error) throw invite.error;
  const accepted = await member.client.rpc("accept_invite", { p_token_hash: hash });
  if (accepted.error) throw accepted.error;
}

let platform: TestUser;
let ownerA: TestUser;
let adminA: TestUser;
let salesA: TestUser;
let viewerA: TestUser;
let ownerB: TestUser;
let outsider: TestUser;
let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Defina as variáveis do Supabase AI Sales em .env.local");
  platform = await createUser("plataforma");
  await service.from("platform_admins").insert({ user_id: platform.id, note: "teste de integração" });
  [ownerA, adminA, salesA, viewerA, ownerB, outsider] = await Promise.all(
    ["owner-a", "admin-a", "sales-a", "viewer-a", "owner-b", "fora"].map(createUser),
  );
  orgA = await createOrg("a", platform, ownerA);
  orgB = await createOrg("b", platform, ownerB);
  await addMember(orgA.id, ownerA, adminA, "admin");
  await addMember(orgA.id, adminA, salesA, "sales");
  await addMember(orgA.id, adminA, viewerA, "viewer");
});

afterAll(async () => {
  if (orgIds.length) await service.from("organizations").delete().in("id", orgIds);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  // Por último: apagar empresas e usuários também gera auditoria.
  await service.from("audit_logs").delete().in("tenant_id", orgIds);
  await service.from("audit_logs").delete().in("actor_id", userIds);
  await service.from("audit_logs").delete().eq("entity_type", "platform_admins").in("entity_id", userIds);
});

describe("isolamento entre empresas", () => {
  it("membro da A não enxerga nada da B (empresa, membros, configurações, convites, auditoria)", async () => {
    for (const user of [ownerA, adminA, salesA]) {
      expect((await user.client.from("organizations").select("id").eq("id", orgB.id)).data).toEqual([]);
      expect((await user.client.from("organization_members").select("user_id").eq("tenant_id", orgB.id)).data).toEqual([]);
      expect((await user.client.from("organization_settings").select("tenant_id").eq("tenant_id", orgB.id)).data).toEqual([]);
      expect((await user.client.from("organization_invites").select("id").eq("tenant_id", orgB.id)).data).toEqual([]);
      expect((await user.client.from("audit_logs").select("id").eq("tenant_id", orgB.id)).data).toEqual([]);
      expect((await user.client.from("subscriptions").select("id").eq("tenant_id", orgB.id)).data).toEqual([]);
    }
  });

  it("owner da A não altera a B, nem convida para a B", async () => {
    await ownerA.client.from("organization_settings").update({ timezone: "UTC" }).eq("tenant_id", orgB.id);
    await ownerA.client.from("organizations").update({ name: "invadida" }).eq("id", orgB.id);
    await ownerA.client.from("organization_members").delete().eq("tenant_id", orgB.id);
    const invite = await ownerA.client.rpc("create_invite", {
      p_tenant: orgB.id,
      p_email: outsider.email,
      p_role: "admin",
      p_token_hash: generateInviteToken().hash,
    });
    expect(invite.error?.message).toContain("not_authorized");

    const { data: settings } = await service.from("organization_settings").select("timezone").eq("tenant_id", orgB.id).single();
    const { data: org } = await service.from("organizations").select("name").eq("id", orgB.id).single();
    const { count } = await service.from("organization_members").select("*", { count: "exact", head: true }).eq("tenant_id", orgB.id);
    expect(settings?.timezone).toBe("America/Sao_Paulo");
    expect(org?.name).toMatch(/^\[TESTE\]/);
    expect(count).toBe(1);
  });

  it("usuário sem vínculo e anônimo não veem nenhuma empresa", async () => {
    expect((await outsider.client.from("organizations").select("id").in("id", orgIds)).data).toEqual([]);
    expect((await anon.from("organizations").select("id").in("id", orgIds)).data ?? []).toEqual([]);
    expect((await anon.from("organization_members").select("user_id").in("tenant_id", orgIds)).data ?? []).toEqual([]);
  });

  it("perfis de usuários de outra empresa não aparecem", async () => {
    const { data } = await salesA.client.from("user_profiles").select("user_id").in("user_id", [ownerB.id, ownerA.id]);
    expect(data?.map((row) => row.user_id)).toEqual([ownerA.id]);
  });

  it("empresa suspensa: membros perdem acesso aos dados, mas a veem listada", async () => {
    const suspended = await service.rpc("platform_set_organization_status", {
      p_actor: platform.id,
      p_tenant: orgB.id,
      p_status: "suspended",
      p_reason: "teste de suspensão",
    });
    expect(suspended.error).toBeNull();
    expect((await ownerB.client.from("organization_settings").select("tenant_id").eq("tenant_id", orgB.id)).data).toEqual([]);
    expect((await ownerB.client.from("organizations").select("status").eq("id", orgB.id)).data).toEqual([{ status: "suspended" }]);
    await service.rpc("platform_set_organization_status", { p_actor: platform.id, p_tenant: orgB.id, p_status: "active", p_reason: "fim do teste" });
  });
});

describe("papéis", () => {
  it("viewer e sales não convidam nem alteram configurações; admin sim", async () => {
    for (const user of [viewerA, salesA]) {
      const invite = await user.client.rpc("create_invite", {
        p_tenant: orgA.id,
        p_email: outsider.email,
        p_role: "viewer",
        p_token_hash: generateInviteToken().hash,
      });
      expect(invite.error?.message).toContain("not_authorized");
      await user.client.from("organization_settings").update({ sales_visibility: "assigned" }).eq("tenant_id", orgA.id);
    }
    expect((await service.from("organization_settings").select("sales_visibility").eq("tenant_id", orgA.id).single()).data?.sales_visibility).toBe("all");

    await adminA.client.from("organization_settings").update({ timezone: "America/Recife" }).eq("tenant_id", orgA.id);
    expect((await service.from("organization_settings").select("timezone").eq("tenant_id", orgA.id).single()).data?.timezone).toBe("America/Recife");
  });

  it("admin não convida OWNER, não promove a OWNER e não mexe no OWNER", async () => {
    const invite = await adminA.client.rpc("create_invite", {
      p_tenant: orgA.id,
      p_email: outsider.email,
      p_role: "owner",
      p_token_hash: generateInviteToken().hash,
    });
    expect(invite.error?.message).toContain("owner_protected");
    const promote = await adminA.client.from("organization_members").update({ role: "owner" }).eq("tenant_id", orgA.id).eq("user_id", salesA.id);
    expect(promote.error?.message).toContain("owner_protected");
    const demote = await adminA.client.from("organization_members").update({ role: "viewer" }).eq("tenant_id", orgA.id).eq("user_id", ownerA.id);
    expect(demote.error?.message).toContain("owner_protected");
  });

  it("sales não vê assinatura, consumo nem auditoria; admin vê", async () => {
    expect((await salesA.client.from("subscriptions").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await salesA.client.from("audit_logs").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await adminA.client.from("subscriptions").select("plan_code").eq("tenant_id", orgA.id)).data).toEqual([{ plan_code: "internal" }]);
  });

  it("admin altera papel de membro comum e a mudança fica auditada com o autor", async () => {
    const update = await adminA.client.from("organization_members").update({ role: "manager" }).eq("tenant_id", orgA.id).eq("user_id", viewerA.id);
    expect(update.error).toBeNull();
    const { data } = await service
      .from("audit_logs")
      .select("actor_id, actor_type, diff")
      .eq("tenant_id", orgA.id)
      .eq("entity_type", "organization_members")
      .eq("action", "update")
      .eq("entity_id", viewerA.id);
    expect(data?.at(-1)).toMatchObject({ actor_id: adminA.id, actor_type: "user", diff: { old: { role: "viewer" }, new: { role: "manager" } } });
    await adminA.client.from("organization_members").update({ role: "viewer" }).eq("tenant_id", orgA.id).eq("user_id", viewerA.id);
  });

  it("auditoria é só leitura até para o owner", async () => {
    const insert = await ownerA.client.from("audit_logs").insert({ actor_type: "user", action: "forjado", entity_type: "x", tenant_id: orgA.id });
    expect(insert.error).not.toBeNull();
  });
});

describe("último OWNER", () => {
  it("não pode ser rebaixado, desativado nem removido", async () => {
    for (const change of [
      () => ownerA.client.from("organization_members").update({ role: "admin" }).eq("tenant_id", orgA.id).eq("user_id", ownerA.id),
      () => ownerA.client.from("organization_members").update({ status: "disabled" }).eq("tenant_id", orgA.id).eq("user_id", ownerA.id),
      () => ownerA.client.from("organization_members").delete().eq("tenant_id", orgA.id).eq("user_id", ownerA.id),
      () => service.from("organization_members").delete().eq("tenant_id", orgA.id).eq("user_id", ownerA.id),
    ]) {
      expect((await change()).error?.message).toContain("last_owner");
    }
  });

  it("com um segundo OWNER, o primeiro pode deixar de ser OWNER", async () => {
    await ownerA.client.from("organization_members").update({ role: "owner" }).eq("tenant_id", orgA.id).eq("user_id", adminA.id);
    const demote = await ownerA.client.from("organization_members").update({ role: "admin" }).eq("tenant_id", orgA.id).eq("user_id", ownerA.id);
    expect(demote.error).toBeNull();
    // Volta ao estado original para os demais testes.
    await adminA.client.from("organization_members").update({ role: "owner" }).eq("tenant_id", orgA.id).eq("user_id", ownerA.id);
    await ownerA.client.from("organization_members").update({ role: "admin" }).eq("tenant_id", orgA.id).eq("user_id", adminA.id);
    const { data } = await service.from("organization_members").select("user_id, role").eq("tenant_id", orgA.id).in("user_id", [ownerA.id, adminA.id]);
    expect(Object.fromEntries((data ?? []).map((row) => [row.user_id, row.role]))).toEqual({ [ownerA.id]: "owner", [adminA.id]: "admin" });
  });
});

describe("convites", () => {
  it("só o e-mail convidado aceita, uma única vez", async () => {
    const { hash } = generateInviteToken();
    await ownerA.client.rpc("create_invite", { p_tenant: orgA.id, p_email: outsider.email, p_role: "viewer", p_token_hash: hash });
    expect((await ownerB.client.rpc("accept_invite", { p_token_hash: hash })).error?.message).toContain("invite_email_mismatch");
    expect((await outsider.client.rpc("accept_invite", { p_token_hash: hash })).error).toBeNull();
    expect((await outsider.client.rpc("accept_invite", { p_token_hash: hash })).error?.message).toContain("invite_used");
    await ownerA.client.from("organization_members").delete().eq("tenant_id", orgA.id).eq("user_id", outsider.id);
  });

  it("convite expirado ou revogado não vale", async () => {
    const expired = generateInviteToken();
    await ownerA.client.rpc("create_invite", { p_tenant: orgA.id, p_email: outsider.email, p_role: "viewer", p_token_hash: expired.hash });
    await service.from("organization_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", expired.hash);
    expect((await outsider.client.rpc("accept_invite", { p_token_hash: expired.hash })).error?.message).toContain("invite_invalid");
    expect((await anon.rpc("get_invite_preview", { p_token_hash: expired.hash })).data).toEqual([]);
    await service.from("organization_invites").update({ revoked_at: new Date().toISOString() }).eq("token_hash", expired.hash);

    const revoked = generateInviteToken();
    const { data: inviteId } = await ownerA.client.rpc("create_invite", { p_tenant: orgA.id, p_email: outsider.email, p_role: "viewer", p_token_hash: revoked.hash });
    await adminA.client.from("organization_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId!);
    expect((await outsider.client.rpc("accept_invite", { p_token_hash: revoked.hash })).error?.message).toContain("invite_invalid");
  });

  it("prévia pública mostra só o convite válido; o hash do token nunca é legível", async () => {
    const valid = generateInviteToken();
    await ownerA.client.rpc("create_invite", { p_tenant: orgA.id, p_email: outsider.email, p_role: "sales", p_token_hash: valid.hash });
    const { data } = await anon.rpc("get_invite_preview", { p_token_hash: valid.hash });
    expect(data).toEqual([expect.objectContaining({ organization_slug: orgA.slug, email: outsider.email, role: "sales" })]);
    const hashRead = await ownerA.client.from("organization_invites").select("token_hash").eq("tenant_id", orgA.id);
    expect(hashRead.error).not.toBeNull();
  });
});

describe("plataforma, consumo e limites (só a secret key)", () => {
  it("usuário comum não chama funções de plataforma nem cria empresa direto", async () => {
    const rpc = await ownerA.client.rpc("platform_set_organization_status", {
      p_actor: ownerA.id,
      p_tenant: orgB.id,
      p_status: "suspended",
      p_reason: "tentativa",
    });
    expect(rpc.error).not.toBeNull();
    const insert = await ownerA.client.from("organizations").insert({ slug: `zz-x-${runTag}`, name: "Invasora" });
    expect(insert.error).not.toBeNull();
  });

  it("secret key com autor que não é superadmin também é recusada", async () => {
    const result = await service.rpc("platform_set_organization_status", {
      p_actor: ownerA.id,
      p_tenant: orgB.id,
      p_status: "suspended",
      p_reason: "tentativa",
    });
    expect(result.error?.message).toContain("not_platform_admin");
  });

  it("ação de plataforma fica auditada com o superadmin e o motivo", async () => {
    const { data } = await service
      .from("audit_logs")
      .select("actor_id, actor_type, reason")
      .eq("tenant_id", orgB.id)
      .eq("entity_type", "organizations")
      .eq("action", "update");
    expect(data).toContainEqual({ actor_id: platform.id, actor_type: "platform_admin", reason: "teste de suspensão" });
  });

  it("reserva respeita o limite do plano, é idempotente e libera ao cancelar", async () => {
    await service.from("subscriptions").update({ limit_overrides: { ai_cost_usd: 1 } }).eq("tenant_id", orgA.id);
    const first = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.6, p_key: `zz-${runTag}-1` });
    expect(first.error).toBeNull();
    const again = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.6, p_key: `zz-${runTag}-1` });
    expect(again.data).toBe(first.data);
    const over = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.6, p_key: `zz-${runTag}-2` });
    expect(over.error?.message).toContain("usage_limit_exceeded");
    await service.rpc("settle_usage", { p_tenant: orgA.id, p_reservation: first.data!, p_actual: 0.1 });
    const after = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.6, p_key: `zz-${runTag}-3` });
    expect(after.error).toBeNull();
  });

  it("métrica sem limite no plano é bloqueada; empresa B não usa limite da A", async () => {
    const unknown = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "metrica_inexistente", p_amount: 1, p_key: `zz-${runTag}-4` });
    expect(unknown.error?.message).toContain("limit_not_configured");
    // A já consumiu/reservou quase todo o limite dela; isso não conta para a B.
    const otherTenant = await service.rpc("reserve_usage", { p_tenant: orgB.id, p_metric: "ai_cost_usd", p_amount: 0.9, p_key: `zz-${runTag}-5` });
    expect(otherTenant.error).toBeNull();
    const overA = await service.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.9, p_key: `zz-${runTag}-6` });
    expect(overA.error?.message).toContain("usage_limit_exceeded");
  });

  it("usuário comum não reserva consumo nem usa o limitador", async () => {
    expect((await ownerA.client.rpc("reserve_usage", { p_tenant: orgA.id, p_metric: "ai_cost_usd", p_amount: 0.01, p_key: "x" })).error).not.toBeNull();
    expect((await anon.rpc("consume_rate_limit", { p_key: "x:y", p_window_seconds: 60, p_max: 1 })).error).not.toBeNull();
  });

  it("limitador de tentativas bloqueia acima do máximo na janela", async () => {
    const key = `zz-teste:${runTag}`;
    const results = [];
    for (let i = 0; i < 3; i++) results.push((await service.rpc("consume_rate_limit", { p_key: key, p_window_seconds: 300, p_max: 2 })).data);
    expect(results).toEqual([true, true, false]);
    await service.from("rate_limits").delete().eq("bucket_key", key);
  });
});
