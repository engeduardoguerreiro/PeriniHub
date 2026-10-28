import { randomUUID } from "node:crypto";

// Transporte de mensagens isolado do CRM e dos agentes. Hoje: Cloud API da
// Meta (graph.facebook.com) e o simulado, que não envia nada para fora.
// Um provedor parceiro (BSP) entra implementando a mesma interface.

export type SendResult = { waMessageId: string };

export class TransportError extends Error {
  constructor(
    message: string,
    readonly code: "auth" | "rate_limited" | "window_closed" | "invalid_recipient" | "template" | "provider" | "network",
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface WhatsAppTransport {
  readonly name: string;
  sendText(to: string, body: string): Promise<SendResult>;
  sendTemplate(to: string, template: { name: string; language: string; parameters: string[] }): Promise<SendResult>;
}

export function graphVersion() {
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v26.0";
  return /^v\d{2}\.\d$/.test(version) ? version : "v26.0";
}

/** Erros da Graph API traduzidos (códigos conforme a documentação da Cloud API). */
function classify(status: number, body: { error?: { code?: number; message?: string } }) {
  const code = body.error?.code;
  const detail = body.error?.message?.slice(0, 200) ?? `HTTP ${status}`;
  if (status === 401 || code === 190) return new TransportError(`Token inválido ou expirado: ${detail}`, "auth", false);
  if (status === 429 || code === 130429 || code === 131056 || code === 4) return new TransportError(`Limite de envio: ${detail}`, "rate_limited", true);
  if (code === 131047) return new TransportError("Fora da janela de 24 h: use um template aprovado.", "window_closed", false);
  if (code === 131026 || code === 131030) return new TransportError(`Destinatário inválido: ${detail}`, "invalid_recipient", false);
  if (code === 132000 || code === 132001 || code === 132015 || code === 132016) return new TransportError(`Template: ${detail}`, "template", false);
  return new TransportError(`Erro da Meta: ${detail}`, "provider", status >= 500);
}

export class MetaCloudTransport implements WhatsAppTransport {
  readonly name = "meta_cloud";
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
  ) {}

  private async post(payload: Record<string, unknown>): Promise<SendResult> {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${graphVersion()}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new TransportError(`Falha de conexão com a Meta: ${error instanceof Error ? error.message : "erro"}`, "network", true);
    }
    const body = (await response.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } };
    if (!response.ok) throw classify(response.status, body);
    const id = body.messages?.[0]?.id;
    if (!id) throw new TransportError("Resposta da Meta sem id de mensagem.", "provider", false);
    return { waMessageId: id };
  }

  sendText(to: string, body: string) {
    return this.post({ to: to.replace(/^\+/, ""), type: "text", text: { preview_url: false, body } });
  }

  sendTemplate(to: string, template: { name: string; language: string; parameters: string[] }) {
    return this.post({
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.parameters.length ? [{ type: "body", parameters: template.parameters.map((text) => ({ type: "text", text })) }] : [],
      },
    });
  }
}

/** Modo simulado: nada sai para a Meta; devolve um id fictício marcado. */
export class SandboxTransport implements WhatsAppTransport {
  readonly name = "sandbox";
  async sendText() {
    return { waMessageId: `sandbox.${randomUUID()}` };
  }
  async sendTemplate() {
    return { waMessageId: `sandbox.${randomUUID()}` };
  }
}

/** Confere token e número na Meta antes de salvar a conexão manual. */
export async function fetchPhoneNumber(token: string, phoneNumberId: string) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" },
  ).catch(() => null);
  if (!response) throw new TransportError("Falha de conexão com a Meta.", "network", true);
  const body = (await response.json().catch(() => ({}))) as {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    messaging_limit_tier?: string;
    error?: { code?: number; message?: string };
  };
  if (!response.ok) throw classify(response.status, body);
  return body;
}

export type MetaTemplate = { id: string; name: string; language: string; category: string; status: string; components: unknown[] };

export async function fetchTemplates(token: string, wabaId: string): Promise<MetaTemplate[]> {
  const templates: MetaTemplate[] = [];
  let url: string | null = `https://graph.facebook.com/${graphVersion()}/${wabaId}/message_templates?fields=id,name,language,category,status,components&limit=100`;
  for (let page = 0; url && page < 10; page++) {
    const response: Response | null = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);
    if (!response) throw new TransportError("Falha de conexão com a Meta.", "network", true);
    const body = (await response.json().catch(() => ({}))) as { data?: MetaTemplate[]; paging?: { next?: string }; error?: { code?: number; message?: string } };
    if (!response.ok) throw classify(response.status, body);
    templates.push(...(body.data ?? []));
    url = body.paging?.next && body.paging.next.startsWith("https://graph.facebook.com/") ? body.paging.next : null;
  }
  return templates;
}
