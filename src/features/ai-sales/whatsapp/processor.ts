import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import type { Json } from "@/lib/supabase/sales.types";

import { isOptOutText, parseWebhook, type WebhookEvent } from "./webhook";

// Ingestão e processamento dos eventos do WhatsApp. O webhook só grava e
// responde; o processamento roda depois (after() na Vercel) e é idempotente:
// reprocessar o mesmo evento não muda nada. Usa a secret key: roda no
// servidor, nunca com dados vindos do navegador sem validação.

const MAX_ATTEMPTS = 5;

/** Grava cada evento uma vez (dedupe) e devolve os ids novos para processar. */
export async function ingestPayload(payload: unknown) {
  const events = parseWebhook(payload);
  const db = createSalesServiceClient();
  const ids: string[] = [];
  for (const event of events) {
    const { data: number } = await db.from("whatsapp_phone_numbers").select("tenant_id").eq("phone_number_id", event.phoneNumberId).maybeSingle();
    const { data, error } = await db
      .from("webhook_events")
      .upsert(
        {
          dedupe_key: event.dedupeKey,
          tenant_id: number?.tenant_id ?? null,
          phone_number_id: event.phoneNumberId,
          kind: event.kind,
          payload: event as unknown as NonNullable<Json>,
          status: number ? "pending" : "ignored",
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id, status");
    if (error) throw new Error(`Falha ao gravar evento: ${error.message}`);
    for (const row of data ?? []) if (row.status === "pending") ids.push(row.id);
  }
  return { received: events.length, queued: ids };
}

async function handle(event: WebhookEvent) {
  const db = createSalesServiceClient();
  if (event.kind === "status") {
    const { error } = await db.rpc("whatsapp_apply_status", {
      p_wa_message_id: event.waMessageId,
      p_status: event.status,
      p_occurred_at: event.occurredAt,
      p_pricing: (event.pricing ?? null) as Json,
      p_errors: (event.errors ?? null) as Json,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await db.rpc("whatsapp_record_inbound", {
    p_phone_number_id: event.phoneNumberId,
    p_from_e164: event.contactPhone,
    p_profile_name: event.profileName ?? "",
    p_wa_message_id: event.waMessageId,
    p_type: event.type,
    p_body: event.body ?? "",
    p_media: (event.media ?? null) as Json,
    p_occurred_at: event.occurredAt,
    p_sender: event.kind === "echo" ? "business_app" : "contact",
  });
  if (error) throw new Error(error.message);
  const result = data as { status: string; tenant_id?: string; contact_id?: string; conversation_id?: string };

  // "SAIR" e equivalentes: descadastro imediato (supressão + revogação +
  // cancelamento de envios pendentes) e registro na conversa.
  if (event.kind === "message" && result.status === "created" && isOptOutText(event.body) && result.tenant_id && result.contact_id) {
    const optOut = await db.rpc("whatsapp_opt_out", { p_tenant: result.tenant_id, p_contact: result.contact_id, p_source: "Pedido pelo WhatsApp" });
    if (optOut.error) throw new Error(optOut.error.message);
    const { data: conversation } = await db.from("conversations").select("phone_number_id").eq("id", result.conversation_id!).single();
    await db.from("messages").insert({
      tenant_id: result.tenant_id,
      conversation_id: result.conversation_id!,
      phone_number_id: conversation!.phone_number_id,
      direction: "outbound",
      sender_type: "system",
      type: "note",
      body: "Contato pediu para não receber mensagens. Descadastrado do WhatsApp; envios pendentes cancelados.",
      status: "sent",
    });
  }
}

/** Processa eventos pendentes pelo id (ou os mais antigos). Falha → nova tentativa; 5 falhas → dead letter. */
export async function processEvents(ids?: string[], limit = 50) {
  const db = createSalesServiceClient();
  let query = db.from("webhook_events").select("id, payload, attempts").in("status", ["pending", "failed"]).order("received_at").limit(limit);
  if (ids) query = query.in("id", ids);
  const { data: rows } = await query;
  let processed = 0;
  for (const row of rows ?? []) {
    try {
      await handle(row.payload as unknown as WebhookEvent);
      await db.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null }).eq("id", row.id);
      processed++;
    } catch (error) {
      const attempts = row.attempts + 1;
      await db
        .from("webhook_events")
        .update({ status: attempts >= MAX_ATTEMPTS ? "dead_letter" : "failed", attempts, last_error: (error instanceof Error ? error.message : "erro").slice(0, 500) })
        .eq("id", row.id);
      console.error("[ai-sales] evento do WhatsApp falhou:", row.id, error instanceof Error ? error.message : error);
    }
  }
  return processed;
}
