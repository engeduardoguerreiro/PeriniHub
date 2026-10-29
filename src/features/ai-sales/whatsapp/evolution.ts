import { requireSecret } from "@/lib/env";

import { TransportError, type SendResult, type WhatsAppTransport } from "./transport";
import type { InboundEvent, StatusEvent } from "./webhook";

// Conexão NÃO OFICIAL pela Evolution API (WhatsApp Web via Baileys), no mesmo
// servidor usado pelo PeriniFood (decisão D-17). Cada número do AI Sales é
// uma instância "ais-<id do número>"; o prefixo evita colisão com as
// instâncias "pf-" do PeriniFood. Risco de banimento: o gate do banco limita
// os envios proativos (só manuais, com consentimento, poucos por dia).

export function evolutionConfigured() {
  try {
    requireSecret("EVOLUTION_API_URL");
    requireSecret("EVOLUTION_API_KEY");
    requireSecret("EVOLUTION_WEBHOOK_SECRET");
    return true;
  } catch {
    return false;
  }
}

export const instanceName = (numberId: string) => `ais-${numberId}`;
export const evolutionPhoneNumberId = (numberId: string) => `evolution-${numberId}`;

export function numberIdFromInstance(name: unknown) {
  const match = typeof name === "string" ? /^ais-([0-9a-f-]{36})$/.exec(name) : null;
  return match?.[1] ?? null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const base = requireSecret("EVOLUTION_API_URL").replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { apikey: requireSecret("EVOLUTION_API_KEY"), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new TransportError(`Servidor Evolution indisponível: ${error instanceof Error ? error.message : "erro"}`, "network", true);
  }
  return { ok: response.ok, status: response.status, data: (await response.json().catch(() => null)) as T | null };
}

export type EvolutionState = "open" | "connecting" | "close" | "missing";

export async function evolutionState(numberId: string): Promise<EvolutionState> {
  const result = await call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${instanceName(numberId)}`);
  if (result.status === 404) return "missing";
  const state = result.data?.instance?.state;
  return state === "open" || state === "connecting" ? state : "close";
}

/** Cria a instância (se preciso) com o webhook do AI Sales e devolve o QR Code (data URL). */
export async function startEvolutionConnection(numberId: string, webhookUrl: string) {
  const name = instanceName(numberId);
  const state = await evolutionState(numberId);
  if (state === "open") return { state, qr: null };
  if (state === "missing") {
    const created = await call<{ qrcode?: { base64?: string } }>("POST", "/instance/create", {
      instanceName: name,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
        headers: { "x-webhook-secret": requireSecret("EVOLUTION_WEBHOOK_SECRET") },
      },
    });
    if (!created.ok) throw new TransportError(`Não foi possível criar a conexão (HTTP ${created.status}).`, "provider", false);
    if (created.data?.qrcode?.base64) return { state: "connecting" as const, qr: created.data.qrcode.base64 };
  }
  const connect = await call<{ base64?: string }>("GET", `/instance/connect/${name}`);
  return { state: "connecting" as const, qr: connect.data?.base64 ?? null };
}

/** Número conectado na instância (dono), quando o QR já foi lido. */
export async function evolutionOwner(numberId: string) {
  const result = await call<{ ownerJid?: string; profileName?: string; name?: string }[]>("GET", `/instance/fetchInstances?instanceName=${instanceName(numberId)}`);
  const item = Array.isArray(result.data) ? result.data[0] : null;
  const phone = item?.ownerJid?.split("@")[0]?.replace(/\D/g, "");
  return { phone: phone ? `+${phone}` : null, name: item?.profileName ?? null };
}

export async function stopEvolutionConnection(numberId: string) {
  await call("DELETE", `/instance/logout/${instanceName(numberId)}`);
  await call("DELETE", `/instance/delete/${instanceName(numberId)}`);
}

export class EvolutionTransport implements WhatsAppTransport {
  readonly name = "evolution";
  constructor(private readonly numberId: string) {}

  async sendText(to: string, body: string): Promise<SendResult> {
    const result = await call<{ key?: { id?: string } }>("POST", `/message/sendText/${instanceName(this.numberId)}`, {
      number: to.replace(/^\+/, ""),
      text: body,
      // Pausa curta de "digitando", como no PeriniFood: envio menos robótico.
      delay: 1200,
    });
    if (!result.ok) {
      throw new TransportError(
        result.status === 404 ? "Número desconectado do servidor Evolution: conecte de novo pelo QR Code." : `Falha no envio pela Evolution (HTTP ${result.status}).`,
        result.status === 404 ? "auth" : "provider",
        result.status >= 500,
      );
    }
    const id = result.data?.key?.id;
    if (!id) throw new TransportError("Evolution não devolveu o id da mensagem.", "provider", false);
    return { waMessageId: id };
  }

  async sendTemplate(): Promise<SendResult> {
    throw new TransportError("Templates só existem na API oficial.", "template", false);
  }
}

// --- Webhook da Evolution --------------------------------------------------------

type Key = { id?: string; remoteJid?: string; fromMe?: boolean; senderPn?: string; remoteJidAlt?: string };
type Upsert = {
  key?: Key;
  pushName?: string;
  messageTimestamp?: number | string;
  messageType?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string }; imageMessage?: { caption?: string }; documentMessage?: { caption?: string; fileName?: string } };
};
type Update = { keyId?: string; key?: { id?: string; fromMe?: boolean }; status?: string; update?: { status?: string | number } };

const STATUS: Record<string, StatusEvent["status"]> = {
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
  "2": "sent",
  "3": "delivered",
  "4": "read",
  "5": "read",
};

function jidPhone(key: Key) {
  const jid = key.remoteJid ?? "";
  if (/@(g\.us|broadcast|newsletter)$/.test(jid)) return null;
  const raw = (jid.endsWith("@s.whatsapp.net") ? jid : key.senderPn ?? key.remoteJidAlt ?? "").split("@")[0].replace(/\D/g, "");
  return /^\d{8,15}$/.test(raw) ? `+${raw}` : null;
}

export type EvolutionEvents = { events: (InboundEvent | StatusEvent)[]; connection: { numberId: string; state: string } | null };

/** Converte o webhook da Evolution para os mesmos eventos do webhook oficial. */
export function parseEvolutionWebhook(body: unknown): EvolutionEvents {
  const payload = (body ?? {}) as { event?: string; instance?: string; data?: unknown };
  const numberId = numberIdFromInstance(payload.instance);
  const event = String(payload.event ?? "").toLowerCase().replace(/_/g, ".");
  if (!numberId) return { events: [], connection: null };
  const phoneNumberId = evolutionPhoneNumberId(numberId);

  if (event === "connection.update") {
    const state = (payload.data as { state?: string } | undefined)?.state ?? "close";
    return { events: [], connection: { numberId, state } };
  }

  const items = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  const events: (InboundEvent | StatusEvent)[] = [];
  if (event === "messages.upsert") {
    for (const item of items as Upsert[]) {
      const key = item.key ?? {};
      const phone = jidPhone(key);
      if (!key.id || !phone) continue;
      const message = item.message ?? {};
      const body = message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? message.documentMessage?.caption ?? null;
      const type = message.conversation || message.extendedTextMessage ? "text" : (item.messageType ?? "unknown").replace(/Message$/, "");
      const seconds = Number(item.messageTimestamp ?? 0);
      events.push({
        // Mensagem enviada pela própria empresa (API ou celular) chega como fromMe.
        kind: key.fromMe ? "echo" : "message",
        dedupeKey: `evo:${key.fromMe ? "echo" : "msg"}:${numberId}:${key.id}`,
        phoneNumberId,
        contactPhone: phone,
        profileName: key.fromMe ? null : item.pushName ?? null,
        waMessageId: key.id,
        type,
        body,
        media: type === "text" ? null : { kind: type },
        occurredAt: seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString(),
      });
    }
  }
  if (event === "messages.update") {
    for (const item of items as Update[]) {
      const id = item.keyId ?? item.key?.id;
      const status = STATUS[String(item.status ?? item.update?.status ?? "").toUpperCase()];
      if (!id || !status) continue;
      events.push({ kind: "status", dedupeKey: `evo:status:${numberId}:${id}:${status}`, phoneNumberId, waMessageId: id, status, occurredAt: new Date().toISOString(), pricing: null, errors: null });
    }
  }
  return { events, connection: null };
}
