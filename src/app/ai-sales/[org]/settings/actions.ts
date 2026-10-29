"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { clientIpHash, consumeRateLimit } from "@/features/ai-sales/auth/rate-limit";
import { assignableRoles, ORG_ROLES, type OrgRole } from "@/features/ai-sales/auth/roles";
import { requestOrigin } from "@/features/ai-sales/origin";
import { TIMEZONES } from "@/features/ai-sales/tenants/settings";
import { generateInviteToken } from "@/features/ai-sales/tenants/tokens";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Ações de configuração da empresa. Cada uma resolve a empresa pelo slug e
// confere o papel no servidor (findMembership); a gravação usa a sessão do
// usuário, então o RLS e os triggers do banco aplicam as mesmas regras de
// novo (inclusive a proteção de OWNER e do último OWNER). A auditoria é
// gravada pelos triggers.

const uuid = z.uuid();
const roleSchema = z.enum(ORG_ROLES);
const NO_PERMISSION = "Sem permissão para esta ação.";

async function manager(slug: string) {
  return findMembership(slug, "admin");
}

function canAssign(actor: OrgRole, role: OrgRole) {
  return assignableRoles(actor).includes(role);
}

// --- Convites -------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
  role: roleSchema,
});

export async function inviteMember(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const membership = await manager(slug);
  if (!membership) return fail(NO_PERMISSION);
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: formData.get("role"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!canAssign(membership.role, parsed.data.role)) return fail("Você não pode convidar com esse papel.");
  if (!(await consumeRateLimit(`invite:${membership.tenantId}:${await clientIpHash()}`, 3600, 30))) {
    return fail("Muitos convites em pouco tempo. Tente de novo mais tarde.");
  }

  const { token, hash } = generateInviteToken();
  const db = await createSalesSessionClient();
  const { error } = await db.rpc("create_invite", {
    p_tenant: membership.tenantId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: hash,
  });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: `Convite criado para ${parsed.data.email}.`, inviteUrl: `${await requestOrigin()}/ai-sales/convite/${token}` };
}

export async function revokeInvite(slug: string, inviteId: string): Promise<ActionResult> {
  const membership = await manager(slug);
  if (!membership) return fail(NO_PERMISSION);
  if (!uuid.safeParse(inviteId).success) return fail("Convite inválido.");
  const db = await createSalesSessionClient();
  const { data, error } = await db
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("tenant_id", membership.tenantId)
    .is("accepted_at", null)
    .select("id");
  if (error) return fail(dbMessage(error.message));
  if (!data?.length) return fail("Convite não encontrado ou já usado.");
  refresh();
  return { ok: true, message: "Convite revogado." };
}

// --- Membros --------------------------------------------------------------------

async function updateMember(slug: string, userId: string, values: { role?: OrgRole; status?: "active" | "disabled" }): Promise<ActionResult> {
  const membership = await manager(slug);
  if (!membership) return fail(NO_PERMISSION);
  if (!uuid.safeParse(userId).success) return fail("Membro inválido.");
  if (values.role && !canAssign(membership.role, values.role)) return fail("Você não pode atribuir esse papel.");
  const db = await createSalesSessionClient();
  const { data, error } = await db
    .from("organization_members")
    .update(values)
    .eq("tenant_id", membership.tenantId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(dbMessage(error.message));
  if (!data?.length) return fail("Membro não encontrado.");
  refresh();
  return { ok: true, message: "Alteração salva." };
}

export async function changeMemberRole(slug: string, userId: string, role: string): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Papel inválido.");
  return updateMember(slug, userId, { role: parsed.data });
}

export async function setMemberStatus(slug: string, userId: string, active: boolean): Promise<ActionResult> {
  return updateMember(slug, userId, { status: active ? "active" : "disabled" });
}

export async function removeMember(slug: string, userId: string): Promise<ActionResult> {
  const membership = await manager(slug);
  if (!membership) return fail(NO_PERMISSION);
  if (!uuid.safeParse(userId).success) return fail("Membro inválido.");
  if (userId === membership.user.id) return fail("Para sair da empresa, peça a outro administrador.");
  const db = await createSalesSessionClient();
  const { data, error } = await db.from("organization_members").delete().eq("tenant_id", membership.tenantId).eq("user_id", userId).select("user_id");
  if (error) return fail(dbMessage(error.message));
  if (!data?.length) return fail("Membro não encontrado.");
  refresh();
  return { ok: true, message: "Membro removido." };
}

// --- Empresa --------------------------------------------------------------------

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120),
  legalName: z.string().trim().max(200),
  timezone: z.enum(TIMEZONES),
  salesVisibility: z.enum(["all", "assigned"]),
});

export async function updateOrganization(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const membership = await manager(slug);
  if (!membership) return fail(NO_PERMISSION);
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") ?? "",
    timezone: formData.get("timezone"),
    salesVisibility: formData.get("salesVisibility"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const db = await createSalesSessionClient();
  const [org, settings] = await Promise.all([
    db
      .from("organizations")
      .update({ name: parsed.data.name, legal_name: parsed.data.legalName || null })
      .eq("id", membership.tenantId)
      .select("id"),
    db
      .from("organization_settings")
      .update({ timezone: parsed.data.timezone, sales_visibility: parsed.data.salesVisibility, updated_by: membership.user.id })
      .eq("tenant_id", membership.tenantId)
      .select("tenant_id"),
  ]);
  const error = org.error ?? settings.error;
  if (error) return fail(dbMessage(error.message));
  if (!org.data?.length || !settings.data?.length) return fail(NO_PERMISSION);
  refresh();
  return { ok: true, message: "Dados da empresa salvos." };
}
