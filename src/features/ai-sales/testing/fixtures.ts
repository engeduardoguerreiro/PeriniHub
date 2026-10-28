import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/sales.types";

import { generateInviteToken } from "../tenants/tokens";

// Fixtures dos testes de integração contra o Supabase "AI Sales" (dev).
// Criam usuários e empresas marcados com zz-teste-<tag> e apagam tudo no fim.

export type Db = SupabaseClient<Database>;
export type Role = Database["public"]["Enums"]["org_role"];
export type TestUser = { id: string; email: string; client: Db };

export function createFixtures(prefix: string) {
  const url = process.env.NEXT_PUBLIC_SALES_SUPABASE_URL!;
  const publishable = process.env.NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY!;
  const secret = process.env.SALES_SUPABASE_SECRET_KEY!;
  if (!url || !publishable || !secret) throw new Error("Defina as variáveis do Supabase AI Sales em .env.local");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  const service: Db = createClient<Database>(url, secret, options);
  const anon: Db = createClient<Database>(url, publishable, options);
  const tag = `${prefix}-${randomBytes(4).toString("hex")}`;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  let platformAdmin: TestUser | null = null;

  async function createUser(label: string): Promise<TestUser> {
    const email = `zz-teste-${label}-${tag}@teste.perinihub.local`;
    const password = randomBytes(18).toString("base64url");
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient<Database>(url, publishable, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return { id: data.user.id, email, client };
  }

  async function platform() {
    if (!platformAdmin) {
      platformAdmin = await createUser("plataforma");
      await service.from("platform_admins").insert({ user_id: platformAdmin.id, note: "teste de integração" });
    }
    return platformAdmin;
  }

  async function createOrg(label: string, owner: TestUser) {
    const actor = await platform();
    const { hash } = generateInviteToken();
    const { data: id, error } = await service.rpc("platform_create_organization", {
      p_actor: actor.id,
      p_name: `[TESTE] Empresa ${label}`,
      p_slug: `zz-${label}-${tag}`,
      p_owner_email: owner.email,
      p_owner_token_hash: hash,
      p_reason: "teste de integração",
    });
    if (error) throw error;
    orgIds.push(id);
    const accepted = await owner.client.rpc("accept_invite", { p_token_hash: hash });
    if (accepted.error) throw accepted.error;
    return { id, slug: accepted.data };
  }

  async function addMember(tenant: string, by: TestUser, member: TestUser, role: Role) {
    const { hash } = generateInviteToken();
    const invite = await by.client.rpc("create_invite", { p_tenant: tenant, p_email: member.email, p_role: role, p_token_hash: hash });
    if (invite.error) throw invite.error;
    const accepted = await member.client.rpc("accept_invite", { p_token_hash: hash });
    if (accepted.error) throw accepted.error;
  }

  async function cleanup() {
    if (orgIds.length) await service.from("organizations").delete().in("id", orgIds);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
    if (orgIds.length) await service.from("audit_logs").delete().in("tenant_id", orgIds);
    if (userIds.length) {
      await service.from("audit_logs").delete().in("actor_id", userIds);
      await service.from("audit_logs").delete().eq("entity_type", "platform_admins").in("entity_id", userIds);
    }
  }

  return { service, anon, tag, createUser, createOrg, addMember, cleanup };
}
