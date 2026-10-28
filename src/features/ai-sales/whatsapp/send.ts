import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import type { Database } from "@/lib/supabase/sales.types";

import { EvolutionTransport } from "./evolution";
import { MetaCloudTransport, SandboxTransport, TransportError, type WhatsAppTransport } from "./transport";

// Envio de mensagens. Ordem fixa: (1) gate no banco com a sessão de quem
// pede — registra decisão e verificações; (2) reserva de consumo; (3) envio
// pelo transporte; (4) grava mensagem e resultado. Bloqueado no gate = nada
// sai. Mesmo pedido (idempotency key) nunca envia duas vezes.

type Db = SupabaseClient<Database>;

export const CHECK_LABELS: Record<string, string> = {
  organization_active: "empresa ativa",
  number_active: "número conectado",
  has_phone: "contato com telefone",
  suppression: "contato descadastrado",
  service_window: "fora da janela de 24 h (use um template aprovado)",
  body: "mensagem vazia ou longa demais",
  template_approved: "template não aprovado",
  consent: "sem consentimento vigente para essa finalidade",
  frequency: "limite de mensagens proativas da semana atingido",
  campaign_active: "campanha pausada ou cancelada",
  provider_kind: "templates não existem na conexão não oficial",
  manual_only: "conexão não oficial: só envio manual inicia conversa",
  daily_limit: "limite diário de mensagens proativas deste número atingido",
};

export type SendInput = {
  db: Db;
  tenantId: string;
  contactId: string;
  phoneNumberId: string;
  origin: "user" | "agent" | "campaign" | "followup" | "system";
  senderUserId?: string | null;
  idempotencyKey?: string;
} & ({ kind: "free_text"; body: string } | { kind: "template"; templateId: string; parameters: string[]; purpose?: "marketing" | "sales_followup" | "service" | "transactional" });

export type SendOutcome = { ok: true; messageId: string } | { ok: false; reason: string; blocked?: string[] };

async function transportFor(accountId: string, provider: string, phoneNumberId: string, numberRowId: string): Promise<WhatsAppTransport> {
  if (provider === "sandbox") return new SandboxTransport();
  if (provider === "evolution") return new EvolutionTransport(numberRowId);
  const { data: token, error } = await createSalesServiceClient().rpc("whatsapp_get_access_token", { p_account: accountId });
  if (error || !token) throw new TransportError("Conta sem token de acesso configurado.", "auth", false);
  return new MetaCloudTransport(token, phoneNumberId);
}

export async function sendWhatsApp(input: SendInput): Promise<SendOutcome> {
  const key = input.idempotencyKey ?? `${input.origin}:${randomUUID()}`;
  const { data: request, error } = await input.db.rpc("whatsapp_send_gate", {
    p_tenant: input.tenantId,
    p_contact: input.contactId,
    p_phone_number: input.phoneNumberId,
    p_kind: input.kind,
    p_origin: input.origin,
    p_idempotency_key: key,
    p_body: input.kind === "free_text" ? input.body : undefined,
    p_template: input.kind === "template" ? input.templateId : undefined,
    p_purpose: input.kind === "template" ? input.purpose : undefined,
  });
  if (error || !request) return { ok: false, reason: error?.message.includes("not_authorized") ? "Sem permissão para enviar." : "Não foi possível validar o envio." };
  if (request.decision === "blocked") {
    const blocked = Object.entries(request.checks as Record<string, { ok: boolean }>)
      .filter(([, check]) => !check.ok)
      .map(([name]) => CHECK_LABELS[name] ?? name);
    return { ok: false, reason: `Envio bloqueado: ${blocked.join("; ")}.`, blocked };
  }
  if (request.status !== "pending") return { ok: false, reason: "Este envio já foi processado." };

  const service = createSalesServiceClient();
  const { data: number } = await service
    .from("whatsapp_phone_numbers")
    .select("id, phone_number_id, account:whatsapp_accounts(id, provider)")
    .eq("id", input.phoneNumberId)
    .eq("tenant_id", input.tenantId)
    .single();
  const { data: contact } = await service.from("contacts").select("phone_e164").eq("id", input.contactId).eq("tenant_id", input.tenantId).single();
  const template =
    input.kind === "template"
      ? (await service.from("whatsapp_templates").select("name, language").eq("id", input.templateId).eq("tenant_id", input.tenantId).single()).data
      : null;
  if (!number?.account || !contact?.phone_e164) return { ok: false, reason: "Número ou contato não encontrado." };

  const reservation = await service.rpc("reserve_usage", { p_tenant: input.tenantId, p_metric: "whatsapp_messages", p_amount: 1, p_key: `send:${request.id}` });
  if (reservation.error) {
    await service.from("message_send_requests").update({ status: "failed", error: "limite mensal de mensagens", finished_at: new Date().toISOString() }).eq("id", request.id);
    return { ok: false, reason: "Limite mensal de mensagens do plano atingido." };
  }

  try {
    const transport = await transportFor(number.account.id, number.account.provider, number.phone_number_id, number.id);
    const sent =
      input.kind === "free_text"
        ? await transport.sendText(contact.phone_e164, input.body)
        : await transport.sendTemplate(contact.phone_e164, { name: template!.name, language: template!.language, parameters: input.parameters });

    const now = new Date().toISOString();
    const preview = input.kind === "free_text" ? input.body : `[template ${template!.name}]`;
    let conversationId = request.conversation_id;
    if (!conversationId) {
      const created = await service
        .from("conversations")
        .insert({ tenant_id: input.tenantId, contact_id: input.contactId, phone_number_id: input.phoneNumberId })
        .select("id")
        .single();
      conversationId = created.data?.id ?? null;
    }
    const { data: message } = await service
      .from("messages")
      .insert({
        tenant_id: input.tenantId,
        conversation_id: conversationId!,
        phone_number_id: input.phoneNumberId,
        direction: "outbound",
        sender_type: input.origin === "agent" ? "agent" : input.origin === "user" ? "user" : "system",
        sender_user_id: input.senderUserId ?? null,
        type: input.kind === "free_text" ? "text" : "template",
        body: input.kind === "free_text" ? input.body : null,
        template_name: template?.name ?? null,
        wa_message_id: sent.waMessageId,
        status: "sent",
        send_request_id: request.id,
      })
      .select("id")
      .single();
    await Promise.all([
      service.from("message_send_requests").update({ status: "sent", wa_message_id: sent.waMessageId, attempts: request.attempts + 1, finished_at: now }).eq("id", request.id),
      service.from("conversations").update({ last_message_at: now, last_message_preview: preview.slice(0, 140), unread_count: 0 }).eq("id", conversationId!),
      service.rpc("settle_usage", { p_tenant: input.tenantId, p_reservation: reservation.data, p_actual: 1, p_source_type: "message_send_request", p_source_id: request.id }),
    ]);
    return { ok: true, messageId: message?.id ?? "" };
  } catch (cause) {
    const reason = cause instanceof TransportError ? cause.message : "Falha ao enviar.";
    await Promise.all([
      service.from("message_send_requests").update({ status: "failed", error: reason.slice(0, 1000), attempts: request.attempts + 1, finished_at: new Date().toISOString() }).eq("id", request.id),
      service.rpc("release_usage", { p_tenant: input.tenantId, p_reservation: reservation.data }),
    ]);
    return { ok: false, reason };
  }
}
