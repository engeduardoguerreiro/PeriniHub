"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findPlatformAdmin } from "@/features/ai-sales/auth/dal";
import { requestOrigin } from "@/features/ai-sales/origin";
import { isReservedOrgSlug, isValidOrgSlug } from "@/features/ai-sales/paths";
import { generateInviteToken } from "@/features/ai-sales/tenants/tokens";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

// Ações do superadmin. Conferem o papel no servidor e chamam funções do banco
// com a secret key; as funções conferem de novo se o autor é superadmin e
// gravam autor e motivo na auditoria.

const NO_PERMISSION = "Ação restrita ao superadmin.";

const createSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120),
  slug: z
    .string()
    .trim()
    .refine(isValidOrgSlug, "Identificador: 3 a 48 caracteres, minúsculas, números e hífens.")
    .refine((slug) => !isReservedOrgSlug(slug), "Identificador reservado. Escolha outro."),
  legalName: z.string().trim().max(200),
  document: z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value === "" || value.length === 14, "CNPJ precisa ter 14 dígitos."),
  ownerEmail: z.email("E-mail do proprietário inválido.").max(254),
});

export async function createOrganization(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    legalName: formData.get("legalName") ?? "",
    document: formData.get("document") ?? "",
    ownerEmail: String(formData.get("ownerEmail") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const { token, hash } = generateInviteToken();
  const { error } = await createSalesServiceClient().rpc("platform_create_organization", {
    p_actor: admin.id,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_owner_email: parsed.data.ownerEmail,
    p_owner_token_hash: hash,
    p_legal_name: parsed.data.legalName || undefined,
    p_document: parsed.data.document || undefined,
    p_reason: "criação de empresa",
  });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return {
    ok: true,
    message: `Empresa ${parsed.data.name} criada. Envie o convite de proprietário para ${parsed.data.ownerEmail}.`,
    inviteUrl: `${await requestOrigin()}/ai-sales/convite/${token}`,
  };
}

const uuid = z.uuid();

export async function setOrganizationStatus(tenantId: string, status: "active" | "suspended", reason?: string): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  if (!uuid.safeParse(tenantId).success) return fail("Empresa inválida.");
  if (!reason || reason.trim().length < 3) return fail("Informe o motivo (mínimo 3 caracteres).");
  const { error } = await createSalesServiceClient().rpc("platform_set_organization_status", {
    p_actor: admin.id,
    p_tenant: tenantId,
    p_status: status,
    p_reason: reason.trim().slice(0, 500),
  });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: status === "suspended" ? "Empresa suspensa." : "Empresa reativada." };
}

export async function reissueOwnerInvite(tenantId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!uuid.safeParse(tenantId).success || !email.success) return fail("Dados inválidos.");
  const { token, hash } = generateInviteToken();
  const { error } = await createSalesServiceClient().rpc("platform_invite_owner", {
    p_actor: admin.id,
    p_tenant: tenantId,
    p_email: email.data,
    p_token_hash: hash,
    p_reason: "novo convite de proprietário",
  });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Novo convite gerado.", inviteUrl: `${await requestOrigin()}/ai-sales/convite/${token}` };
}
