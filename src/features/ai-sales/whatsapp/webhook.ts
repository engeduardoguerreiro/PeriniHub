import { z } from "zod";

// Parser tolerante do webhook da Cloud API: extrai só o que usamos e ignora
// o resto. Cada evento ganha uma chave de deduplicação estável — a Meta
// reenvia o mesmo evento quando não recebe 200 a tempo.

const text = z.object({ body: z.string() }).partial();
const message = z.object({
  id: z.string().min(1),
  from: z.string().regex(/^\d{8,15}$/),
  to: z.string().optional(),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: text.optional(),
  button: z.object({ text: z.string().optional(), payload: z.string().optional() }).partial().optional(),
  interactive: z.unknown().optional(),
  image: z.object({ id: z.string(), caption: z.string().optional(), mime_type: z.string().optional() }).partial().optional(),
  document: z.object({ id: z.string(), caption: z.string().optional(), filename: z.string().optional() }).partial().optional(),
  audio: z.object({ id: z.string() }).partial().optional(),
});
const status = z.object({
  id: z.string().min(1),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string().regex(/^\d+$/),
  recipient_id: z.string().optional(),
  pricing: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.record(z.string(), z.unknown())).optional(),
});
const value = z.object({
  metadata: z.object({ phone_number_id: z.string(), display_phone_number: z.string().optional() }),
  contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).partial().optional() })).optional(),
  messages: z.array(z.unknown()).optional(),
  statuses: z.array(z.unknown()).optional(),
  // Coexistência: mensagens enviadas pelo app WhatsApp Business do celular.
  message_echoes: z.array(z.unknown()).optional(),
});
const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ id: z.string(), changes: z.array(z.object({ field: z.string(), value: z.unknown() })) })),
});

export type InboundEvent = {
  kind: "message" | "echo";
  dedupeKey: string;
  phoneNumberId: string;
  /** Telefone do contato em E.164 (o cliente, também nos ecos). */
  contactPhone: string;
  profileName: string | null;
  waMessageId: string;
  type: string;
  body: string | null;
  media: Record<string, unknown> | null;
  occurredAt: string;
};

export type StatusEvent = {
  kind: "status";
  dedupeKey: string;
  phoneNumberId: string;
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  occurredAt: string;
  pricing: Record<string, unknown> | null;
  errors: Record<string, unknown>[] | null;
};

export type WebhookEvent = InboundEvent | StatusEvent;

const toIso = (seconds: string) => new Date(Number(seconds) * 1000).toISOString();

function messageContent(item: z.infer<typeof message>) {
  if (item.type === "text") return { body: item.text?.body ?? null, media: null };
  if (item.type === "button") return { body: item.button?.text ?? null, media: null };
  if (item.type === "image") return { body: item.image?.caption ?? null, media: { kind: "image", id: item.image?.id, mime_type: item.image?.mime_type } };
  if (item.type === "document") return { body: item.document?.caption ?? item.document?.filename ?? null, media: { kind: "document", id: item.document?.id } };
  if (item.type === "audio") return { body: null, media: { kind: "audio", id: item.audio?.id } };
  return { body: null, media: { kind: item.type } };
}

/** Lança erro se o corpo não for um webhook do WhatsApp; ignora itens malformados. */
export function parseWebhook(payload: unknown): WebhookEvent[] {
  const parsed = payloadSchema.parse(payload);
  const events: WebhookEvent[] = [];
  for (const entry of parsed.entry) {
    for (const change of entry.changes) {
      const v = value.safeParse(change.value);
      if (!v.success) continue;
      const phoneNumberId = v.data.metadata.phone_number_id;
      const names = new Map((v.data.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null]));

      for (const raw of v.data.messages ?? []) {
        const item = message.safeParse(raw);
        if (!item.success) continue;
        const content = messageContent(item.data);
        events.push({
          kind: "message",
          dedupeKey: `wa:msg:${item.data.id}`,
          phoneNumberId,
          contactPhone: `+${item.data.from}`,
          profileName: names.get(item.data.from) ?? null,
          waMessageId: item.data.id,
          type: item.data.type,
          ...content,
          occurredAt: toIso(item.data.timestamp),
        });
      }
      for (const raw of v.data.message_echoes ?? []) {
        const item = message.safeParse(raw);
        if (!item.success || !item.data.to || !/^\d{8,15}$/.test(item.data.to)) continue;
        const content = messageContent(item.data);
        events.push({
          kind: "echo",
          dedupeKey: `wa:echo:${item.data.id}`,
          phoneNumberId,
          contactPhone: `+${item.data.to}`,
          profileName: null,
          waMessageId: item.data.id,
          type: item.data.type,
          ...content,
          occurredAt: toIso(item.data.timestamp),
        });
      }
      for (const raw of v.data.statuses ?? []) {
        const item = status.safeParse(raw);
        if (!item.success) continue;
        events.push({
          kind: "status",
          dedupeKey: `wa:status:${item.data.id}:${item.data.status}`,
          phoneNumberId,
          waMessageId: item.data.id,
          status: item.data.status,
          occurredAt: toIso(item.data.timestamp),
          pricing: item.data.pricing ?? null,
          errors: item.data.errors ?? null,
        });
      }
    }
  }
  return events;
}

/** Pedido de descadastro por texto. A palavra precisa ser a mensagem inteira (ou quase). */
const OPT_OUT = /^(sair|parar|pare|stop|cancelar|descadastrar|descadastre|remover|nao quero mais|não quero mais|nao quero receber|não quero receber)[.!]*$/i;

export function isOptOutText(body: string | null) {
  if (!body) return false;
  return OPT_OUT.test(body.trim().normalize("NFC"));
}
