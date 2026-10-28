import "server-only";

import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { isAiSalesEnabled, isPlatformMfaRequired } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";
import type { Database } from "@/lib/supabase/sales.types";

import { AI_SALES_LOGIN, isValidOrgSlug } from "../paths";
import { roleAtLeast, type OrgRole } from "./roles";

// Camada de acesso a dados (DAL) do AI Sales. Toda página, Server Action e
// route handler passa por aqui antes de ler ou gravar. `getClaims()` valida a
// assinatura do JWT; papel e vínculo vêm do banco (RLS), nunca do cliente.
// `cache` deduplica as consultas dentro da mesma requisição.

export type SalesUser = { id: string; email: string | null; aal: string | null };

export type Membership = {
  tenantId: string;
  slug: string;
  name: string;
  status: Database["public"]["Enums"]["org_status"];
  role: OrgRole;
};

export const getSalesUser = cache(async (): Promise<SalesUser | null> => {
  if (!isAiSalesEnabled()) return null;
  // A validação do JWT compara a expiração com o relógio: só na requisição,
  // nunca na pré-renderização (Cache Components).
  await connection();
  const db = await createSalesSessionClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    aal: typeof data.claims.aal === "string" ? data.claims.aal : null,
  };
});

export async function requireSalesUser(): Promise<SalesUser> {
  if (!isAiSalesEnabled()) notFound();
  const user = await getSalesUser();
  if (!user) redirect(AI_SALES_LOGIN);
  return user;
}

/** Empresas em que o usuário tem vínculo ativo (inclui suspensas, para o seletor). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getSalesUser();
  if (!user) return [];
  const db = await createSalesSessionClient();
  const { data, error } = await db
    .from("organization_members")
    .select("role, organization:organizations!inner(id, slug, name, status)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw new Error(`Falha ao carregar empresas: ${error.message}`);
  return (data ?? [])
    .map(({ role, organization }) => ({
      tenantId: organization.id,
      slug: organization.slug,
      name: organization.name,
      status: organization.status,
      role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

/**
 * Vínculo do usuário com a empresa do slug. Sem vínculo, empresa inativa ou
 * papel insuficiente → 404, sem revelar se a empresa existe. Trocar o slug na
 * URL nunca dá acesso: a checagem é sempre contra organization_members.
 */
export async function requireMember(slug: string, minRole: OrgRole = "viewer"): Promise<Membership & { user: SalesUser }> {
  const user = await requireSalesUser();
  if (!isValidOrgSlug(slug)) notFound();
  const membership = (await getMemberships()).find((item) => item.slug === slug);
  if (!membership || membership.status !== "active" || !roleAtLeast(membership.role, minRole)) notFound();
  return { ...membership, user };
}

/**
 * Para Server Actions: mesmo critério de requireMember, mas devolve null em
 * vez de interromper, para a action responder com uma mensagem.
 */
export async function findMembership(slug: string, minRole: OrgRole = "viewer") {
  if (!isAiSalesEnabled() || !isValidOrgSlug(slug)) return null;
  const user = await getSalesUser();
  if (!user) return null;
  const membership = (await getMemberships()).find((item) => item.slug === slug);
  if (!membership || membership.status !== "active" || !roleAtLeast(membership.role, minRole)) return null;
  return { ...membership, user };
}

export const isPlatformAdmin = cache(async (userId: string) => {
  // platform_admins não tem policy para usuários: só a secret key lê.
  const { data, error } = await createSalesServiceClient().from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Falha ao conferir superadmin: ${error.message}`);
  return Boolean(data);
});

/** Superadmin (e AAL2, quando a exigência de MFA estiver ligada). Senão, 404. */
export async function requirePlatformAdmin(): Promise<SalesUser> {
  const user = await requireSalesUser();
  if (!(await isPlatformAdmin(user.id))) notFound();
  if (isPlatformMfaRequired() && user.aal !== "aal2") notFound();
  return user;
}

export async function findPlatformAdmin(): Promise<SalesUser | null> {
  if (!isAiSalesEnabled()) return null;
  const user = await getSalesUser();
  if (!user || !(await isPlatformAdmin(user.id))) return null;
  if (isPlatformMfaRequired() && user.aal !== "aal2") return null;
  return user;
}
