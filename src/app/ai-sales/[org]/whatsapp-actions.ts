"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { normalizePhone } from "@/features/ai-sales/crm/phone";
import { ingestPayload, processEvents } from "@/features/ai-sales/whatsapp/processor";
import { sendWhatsApp } from "@/features/ai-sales/whatsapp/send";
import { fetchPhoneNumber, fetchTemplates, TransportError } from "@/features/ai-sales/whatsapp/transport";
import { whatsappMode } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Ações do WhatsApp. Conexão e templates: admin ou acima. Envio e
// atendimento: vendedor ou acima, sempre pelo gate do banco (sendWhatsApp).
// O modo simulado só existe com WHATSAPP_MODE diferente de "live".

const uuid = z.uuid();
const NO_PERMISSION = "Sem permissão para esta ação.";

async function member(slug: string, minRole: "sales" | "admin" = "sales") {
  const membership = await findMembership(slug, minRole);
  if (!membership) return null;
  return { ...membership, db: await createSalesSessionClient() };
}

async function numbersWithinLimit(tenantId: string) {
  const service = createSalesServiceClient();
  const [{ data: limit }, { count }] = await Promise.all([
    service.rpc("effective_limit", { p_tenant: tenantId, p_metric: "whatsapp_numbers" }),
    service.from("whatsapp_phone_numbers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "disconnected"),
  ]);
  return (count ?? 0) < Number(limit ?? 0);
}

// --- Conexão ----------------------------------------------------------------------

export async function connectSandbox(slug: string): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (whatsappMode() === "live") return fail("Modo simulado desativado neste ambiente.");
  if (!(await numbersWithinLimit(m.tenantId))) return fail("Limite de números do plano atingido. Desconecte o número atual antes.");
  const { data: account, error } = await m.db
    .from("whatsapp_accounts")
    .insert({ tenant_id: m.tenantId, provider: "sandbox", display_name: "WhatsApp simulado", status: "active", connected_by: m.user.id, connected_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) return fail(dbMessage(error.message));
  const number = await m.db.from("whatsapp_phone_numbers").insert({
    tenant_id: m.tenantId,
    account_id: account.id,
    phone_number_id: `sandbox-${randomUUID().slice(0, 18)}`,
    display_phone: "+55 00 00000-0000 (simulado)",
    verified_name: "Simulado",
    status: "active",
  });
  if (number.error) return fail(dbMessage(number.error.message));
  await syncTemplates(slug, account.id);
  refresh();
  return { ok: true, message: "Modo simulado ativo. Nada é enviado para a Meta." };
}

const manualSchema = z.object({
  wabaId: z.string().trim().regex(/^\d{5,30}$/, "WABA ID: só números."),
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone Number ID: só números."),
  token: z.string().trim().min(20, "Token muito curto.").max(1000),
  coexistence: z.boolean(),
});

/** Conexão manual (token de usuário do sistema da Meta). Confere na Meta antes de salvar. */
export async function connectMetaManual(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  const parsed = manualSchema.safeParse({
    wabaId: formData.get("wabaId"),
    phoneNumberId: formData.get("phoneNumberId"),
    token: formData.get("token"),
    coexistence: formData.get("coexistence") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!(await numbersWithinLimit(m.tenantId))) return fail("Limite de números do plano atingido.");

  let info: Awaited<ReturnType<typeof fetchPhoneNumber>>;
  try {
    info = await fetchPhoneNumber(parsed.data.token, parsed.data.phoneNumberId);
  } catch (error) {
    return fail(error instanceof TransportError ? error.message : "Não foi possível validar na Meta.");
  }

  const { data: account, error } = await m.db
    .from("whatsapp_accounts")
    .insert({
      tenant_id: m.tenantId,
      provider: "meta_cloud",
      waba_id: parsed.data.wabaId,
      display_name: info.verified_name ?? null,
      status: "active",
      coexistence: parsed.data.coexistence,
      connected_by: m.user.id,
      connected_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return fail(error.message.includes("whatsapp_accounts_waba_key") ? "Essa conta do WhatsApp já está conectada a uma empresa." : dbMessage(error.message));
  const token = await m.db.rpc("whatsapp_set_access_token", { p_tenant: m.tenantId, p_account: account.id, p_token: parsed.data.token });
  if (token.error) return fail(dbMessage(token.error.message));
  const number = await m.db.from("whatsapp_phone_numbers").insert({
    tenant_id: m.tenantId,
    account_id: account.id,
    phone_number_id: parsed.data.phoneNumberId,
    display_phone: info.display_phone_number ?? parsed.data.phoneNumberId,
    verified_name: info.verified_name ?? null,
    quality_rating: info.quality_rating ?? null,
    messaging_limit_tier: info.messaging_limit_tier ?? null,
    status: "active",
  });
  if (number.error) return fail(number.error.message.includes("phone_number_id") ? "Esse número já está conectado." : dbMessage(number.error.message));
  await syncTemplates(slug, account.id);
  refresh();
  return { ok: true, message: `Número ${info.display_phone_number ?? ""} conectado.` };
}

export async function disconnectAccount(slug: string, accountId: string, reason?: string): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(accountId).success) return fail("Conta inválida.");
  if (!reason || reason.trim().length < 3) return fail("Informe o motivo.");
  const [account, numbers] = await Promise.all([
    m.db.from("whatsapp_accounts").update({ status: "disconnected", last_error: `Desconectado: ${reason.trim().slice(0, 400)}` }).eq("tenant_id", m.tenantId).eq("id", accountId).select("id"),
    m.db.from("whatsapp_phone_numbers").update({ status: "disconnected" }).eq("tenant_id", m.tenantId).eq("account_id", accountId),
  ]);
  const error = account.error ?? numbers.error;
  if (error) return fail(dbMessage(error.message));
  if (!account.data?.length) return fail("Conta não encontrada.");
  refresh();
  return { ok: true, message: "Desconectado. O histórico de conversas continua disponível." };
}

const SANDBOX_TEMPLATES = [
  { name: "boas_vindas_simulado", category: "utility" as const, body: "Olá {{1}}, obrigado pelo contato com a {{2}}. Como podemos ajudar?" },
  { name: "oferta_simulada", category: "marketing" as const, body: "Olá {{1}}, temos uma condição especial para você este mês. Quer saber mais?" },
];

export async function syncTemplates(slug: string, accountId: string): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(accountId).success) return fail("Conta inválida.");
  const service = createSalesServiceClient();
  const { data: account } = await service.from("whatsapp_accounts").select("id, provider, waba_id").eq("tenant_id", m.tenantId).eq("id", accountId).single();
  if (!account) return fail("Conta não encontrada.");

  let rows: { name: string; language: string; category: "marketing" | "utility" | "authentication"; status: string; components: unknown[]; meta_template_id: string | null }[];
  if (account.provider === "sandbox") {
    rows = SANDBOX_TEMPLATES.map((template) => ({ name: template.name, language: "pt_BR", category: template.category, status: "APPROVED", components: [{ type: "BODY", text: template.body }], meta_template_id: null }));
  } else {
    const { data: token } = await service.rpc("whatsapp_get_access_token", { p_account: account.id });
    if (!token || !account.waba_id) return fail("Conta sem token ou WABA ID.");
    try {
      const templates = await fetchTemplates(token, account.waba_id);
      rows = templates
        .filter((template) => ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(template.category))
        .map((template) => ({
          name: template.name,
          language: template.language,
          category: template.category.toLowerCase() as "marketing" | "utility" | "authentication",
          status: template.status,
          components: template.components,
          meta_template_id: template.id,
        }));
    } catch (error) {
      return fail(error instanceof TransportError ? error.message : "Falha ao buscar templates.");
    }
  }
  const synced = new Date().toISOString();
  if (rows.length) {
    const { error } = await service
      .from("whatsapp_templates")
      .upsert(rows.map((row) => ({ ...row, components: row.components as never, tenant_id: m.tenantId, account_id: account.id, synced_at: synced })), { onConflict: "account_id,name,language" });
    if (error) return fail(dbMessage(error.message));
  }
  refresh();
  return { ok: true, message: `${rows.length} template(s) sincronizado(s).` };
}

// --- Atendimento -----------------------------------------------------------------

async function loadConversation(m: NonNullable<Awaited<ReturnType<typeof member>>>, conversationId: string) {
  if (!uuid.safeParse(conversationId).success) return null;
  const { data } = await m.db.from("conversations").select("id, contact_id, phone_number_id, status").eq("tenant_id", m.tenantId).eq("id", conversationId).maybeSingle();
  return data;
}

export async function sendText(slug: string, conversationId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 4096) return fail("Escreva a mensagem (até 4.096 caracteres).");
  const conversation = await loadConversation(m, conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  const outcome = await sendWhatsApp({
    db: m.db,
    tenantId: m.tenantId,
    contactId: conversation.contact_id,
    phoneNumberId: conversation.phone_number_id,
    origin: "user",
    senderUserId: m.user.id,
    kind: "free_text",
    body,
    idempotencyKey: `user:${String(formData.get("requestId") ?? randomUUID()).slice(0, 80)}`,
  });
  if (!outcome.ok) return fail(outcome.reason);
  refresh();
  return { ok: true, message: "Enviada." };
}

export async function sendTemplateMessage(slug: string, conversationId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const templateId = String(formData.get("templateId") ?? "");
  const parameters = formData.getAll("param").map((value) => String(value).trim().slice(0, 500));
  if (!uuid.safeParse(templateId).success) return fail("Escolha um template.");
  if (parameters.some((value) => !value)) return fail("Preencha todas as variáveis do template.");
  const conversation = await loadConversation(m, conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  const outcome = await sendWhatsApp({
    db: m.db,
    tenantId: m.tenantId,
    contactId: conversation.contact_id,
    phoneNumberId: conversation.phone_number_id,
    origin: "user",
    senderUserId: m.user.id,
    kind: "template",
    templateId,
    parameters,
    idempotencyKey: `user:${String(formData.get("requestId") ?? randomUUID()).slice(0, 80)}`,
  });
  if (!outcome.ok) return fail(outcome.reason);
  refresh();
  return { ok: true, message: "Template enviado." };
}

export async function assignConversation(slug: string, conversationId: string, userId: string | null): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (userId !== null && !uuid.safeParse(userId).success) return fail("Responsável inválido.");
  const conversation = await loadConversation(m, conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  const { error } = await m.db.from("conversations").update({ assigned_user_id: userId }).eq("tenant_id", m.tenantId).eq("id", conversationId);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: userId ? "Conversa atribuída." : "Atribuição removida." };
}

export async function setConversationStatus(slug: string, conversationId: string, status: "open" | "pending_human" | "closed"): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!["open", "pending_human", "closed"].includes(status)) return fail("Situação inválida.");
  const conversation = await loadConversation(m, conversationId);
  if (!conversation) return fail("Conversa não encontrada.");
  const { error } = await m.db.from("conversations").update({ status }).eq("tenant_id", m.tenantId).eq("id", conversationId);
  if (error) return fail(error.message.includes("conversations_active_key") ? "Já existe outra conversa aberta com esse contato." : dbMessage(error.message));
  refresh();
  return { ok: true, message: status === "closed" ? "Conversa encerrada." : "Conversa reaberta." };
}

export async function markRead(slug: string, conversationId: string): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(conversationId).success) return fail("Conversa inválida.");
  await m.db.from("conversations").update({ unread_count: 0 }).eq("tenant_id", m.tenantId).eq("id", conversationId).gt("unread_count", 0);
  return { ok: true, message: "" };
}

// --- Simulador (modo simulado) ---------------------------------------------------

/**
 * Gera um evento no formato do webhook da Meta para o número simulado da
 * empresa e passa pelo mesmo caminho de ingestão e processamento do real.
 */
export async function simulateInbound(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (whatsappMode() === "live") return fail("Simulador desativado neste ambiente.");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (!phone || !body) return fail("Informe telefone válido e mensagem.");
  const { data: number } = await m.db
    .from("whatsapp_phone_numbers")
    .select("phone_number_id, account:whatsapp_accounts!inner(provider)")
    .eq("tenant_id", m.tenantId)
    .eq("status", "active")
    .eq("whatsapp_accounts.provider", "sandbox")
    .limit(1)
    .maybeSingle();
  if (!number) return fail("Ative o modo simulado em Configurações → WhatsApp.");
  const from = phone.replace(/^\+/, "");
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "0",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: number.phone_number_id, display_phone_number: "000" },
              contacts: [{ wa_id: from, profile: { name: name || from } }],
              messages: [{ from, id: `sandbox.in.${randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
  const { queued } = await ingestPayload(payload);
  await processEvents(queued);
  refresh();
  return { ok: true, message: "Mensagem simulada recebida." };
}
