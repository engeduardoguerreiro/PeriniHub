"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findPlatformAdmin } from "@/features/ai-sales/auth/dal";
import { limitsFromForm } from "@/features/ai-sales/billing/limits";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

// Planos, assinaturas e cobrança manual. Mesmo padrão das demais ações do
// superadmin: confere o papel aqui, a função do banco confere de novo e grava
// autor e motivo (obrigatório) na auditoria.

const NO_PERMISSION = "Ação restrita ao superadmin.";
const uuid = z.uuid();
const reason = z.string().trim().min(3, "Informe o motivo (mínimo 3 caracteres).").max(500);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const optionalDate = z.union([z.iso.date(), z.literal("")]).transform((value) => value || null);

/** "199,90" → 19990 centavos; vazio → null. */
const money = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const number = Number(normalized);
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(number)) {
      ctx.addIssue({ code: "custom", message: "Valor inválido (ex.: 199,90)." });
      return z.NEVER;
    }
    return Math.round(number * 100);
  });

const planSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Código: 2 a 40 caracteres (minúsculas, números e _)."),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  description: z.string().trim().max(500),
  price: money,
  priceIsFinal: z.boolean(),
  isPublic: z.boolean(),
  active: z.boolean(),
  reason,
});

export async function upsertPlan(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  const parsed = planSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    priceIsFinal: formData.get("priceIsFinal") === "on",
    isPublic: formData.get("isPublic") === "on",
    active: formData.get("active") === "on",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const limits = limitsFromForm(formData);
  if (!limits.ok) return fail(limits.error);
  if (parsed.data.priceIsFinal && parsed.data.price === null) return fail("Preço definitivo exige valor.");
  const { error } = await createSalesServiceClient().rpc("platform_upsert_plan", {
    p_actor: admin.id,
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_limits: limits.limits,
    p_price_monthly_cents: parsed.data.price,
    p_price_is_final: parsed.data.priceIsFinal,
    p_is_public: parsed.data.isPublic,
    p_active: parsed.data.active,
    p_reason: parsed.data.reason,
    // O gerador de tipos não marca argumentos de função como anuláveis; a função aceita null.
  } as never);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: `Plano ${parsed.data.name} salvo.` };
}

const subscriptionSchema = z.object({
  planCode: z.string().regex(/^[a-z0-9_]{2,40}$/, "Plano inválido."),
  status: z.enum(["trial", "active", "past_due", "canceled", "internal"]),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  notes: optionalText(1000),
  reason,
});

export async function updateSubscription(tenantId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  if (!uuid.safeParse(tenantId).success) return fail("Empresa inválida.");
  const parsed = subscriptionSchema.safeParse({
    planCode: formData.get("planCode"),
    status: formData.get("status"),
    periodStart: formData.get("periodStart") ?? "",
    periodEnd: formData.get("periodEnd") ?? "",
    notes: formData.get("notes") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { periodStart, periodEnd } = parsed.data;
  if (periodStart && periodEnd && periodEnd < periodStart) return fail("O fim do período precisa ser depois do início.");
  const overrides = limitsFromForm(formData);
  if (!overrides.ok) return fail(overrides.error);
  const { error } = await createSalesServiceClient().rpc("platform_update_subscription", {
    p_actor: admin.id,
    p_tenant: tenantId,
    p_plan_code: parsed.data.planCode,
    p_status: parsed.data.status,
    p_period_start: periodStart ? `${periodStart}T00:00:00-03:00` : null,
    p_period_end: periodEnd ? `${periodEnd}T23:59:59-03:00` : null,
    p_limit_overrides: overrides.limits,
    p_notes: parsed.data.notes,
    p_reason: parsed.data.reason,
  } as never);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Assinatura atualizada." };
}

const invoiceSchema = z.object({
  description: z.string().trim().min(3, "Descreva a cobrança.").max(300),
  amount: money.refine((value) => value !== null && value > 0, "Informe o valor."),
  dueDate: z.iso.date("Informe o vencimento."),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  notes: optionalText(1000),
  reason,
});

export async function createInvoice(tenantId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  if (!uuid.safeParse(tenantId).success) return fail("Empresa inválida.");
  const parsed = invoiceSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount") ?? "",
    dueDate: formData.get("dueDate"),
    periodStart: formData.get("periodStart") ?? "",
    periodEnd: formData.get("periodEnd") ?? "",
    notes: formData.get("notes") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await createSalesServiceClient().rpc("platform_create_invoice", {
    p_actor: admin.id,
    p_tenant: tenantId,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amount,
    p_due_date: parsed.data.dueDate,
    p_period_start: parsed.data.periodStart,
    p_period_end: parsed.data.periodEnd,
    p_notes: parsed.data.notes,
    p_reason: parsed.data.reason,
  } as never);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Cobrança criada como rascunho." };
}

export async function setInvoiceStatus(invoiceId: string, status: "issued" | "paid" | "canceled", paymentMethod: string | null, reasonText?: string): Promise<ActionResult> {
  const admin = await findPlatformAdmin();
  if (!admin) return fail(NO_PERMISSION);
  if (!uuid.safeParse(invoiceId).success || !["issued", "paid", "canceled"].includes(status)) return fail("Dados inválidos.");
  const parsedReason = reason.safeParse(reasonText ?? "");
  if (!parsedReason.success) return fail("Informe o motivo (mínimo 3 caracteres).");
  const { error } = await createSalesServiceClient().rpc("platform_set_invoice_status", {
    p_actor: admin.id,
    p_invoice: invoiceId,
    p_status: status,
    p_payment_method: paymentMethod,
    p_external_ref: null,
    p_reason: parsedReason.data,
  } as never);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: status === "issued" ? "Cobrança emitida." : status === "paid" ? "Pagamento registrado." : "Cobrança cancelada." };
}
