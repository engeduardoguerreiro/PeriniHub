import { describe, expect, it } from "vitest";

import { safeEqual, signPayload, verifySignature } from "./signature";
import { inServiceWindow, templateBody } from "./templates";
import { isOptOutText, parseWebhook } from "./webhook";

const SECRET = "0123456789abcdef0123456789abcdef";

function payload(value: Record<string, unknown>, field = "messages") {
  return { object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field, value: { messaging_product: "whatsapp", metadata: { phone_number_id: "106540352242922" }, ...value } }] }] };
}

describe("assinatura do webhook", () => {
  it("aceita só o HMAC-SHA256 do corpo exato com o app secret", () => {
    const body = JSON.stringify(payload({}));
    const header = signPayload(body, SECRET);
    expect(verifySignature(body, header, SECRET)).toBe(true);
    expect(verifySignature(`${body} `, header, SECRET)).toBe(false);
    expect(verifySignature(body, signPayload(body, "f".repeat(32)), SECRET)).toBe(false);
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha1=abc", SECRET)).toBe(false);
  });

  it("compara o verify token em tempo constante", () => {
    expect(safeEqual("token-certo", "token-certo")).toBe(true);
    expect(safeEqual("token-errado", "token-certo")).toBe(false);
    expect(safeEqual(null, "token-certo")).toBe(false);
  });
});

describe("parser do webhook", () => {
  it("extrai mensagem recebida com telefone E.164, nome e chave de deduplicação", () => {
    const events = parseWebhook(
      payload({
        contacts: [{ wa_id: "5511987654321", profile: { name: "Ana" } }],
        messages: [{ from: "5511987654321", id: "wamid.A", timestamp: "1750000000", type: "text", text: { body: "Olá" } }],
      }),
    );
    expect(events).toEqual([
      expect.objectContaining({ kind: "message", dedupeKey: "wa:msg:wamid.A", phoneNumberId: "106540352242922", contactPhone: "+5511987654321", profileName: "Ana", body: "Olá", occurredAt: "2025-06-15T15:06:40.000Z" }),
    ]);
  });

  it("status gera uma chave por estágio; eco do celular (coexistência) aponta para o cliente", () => {
    const events = parseWebhook(
      payload({
        statuses: [
          { id: "wamid.B", status: "delivered", timestamp: "1750000001", recipient_id: "5511987654321" },
          { id: "wamid.B", status: "read", timestamp: "1750000002" },
        ],
        message_echoes: [{ from: "5511975418690", to: "5511987654321", id: "wamid.C", timestamp: "1750000003", type: "text", text: { body: "Respondi pelo celular" } }],
      }),
    );
    expect(events.map((event) => event.dedupeKey)).toEqual(["wa:echo:wamid.C", "wa:status:wamid.B:delivered", "wa:status:wamid.B:read"]);
    expect(events[0]).toMatchObject({ kind: "echo", contactPhone: "+5511987654321" });
  });

  it("ignora itens malformados e recusa o que não é webhook do WhatsApp", () => {
    expect(parseWebhook(payload({ messages: [{ from: "abc", id: "x", timestamp: "1", type: "text" }], statuses: [{ id: "y", status: "deleted", timestamp: "1" }] }))).toEqual([]);
    expect(() => parseWebhook({ object: "page", entry: [] })).toThrow();
  });
});

describe("descadastro, janela e templates", () => {
  it("reconhece pedidos de descadastro como mensagem inteira, sem falso positivo em frases", () => {
    for (const text of ["SAIR", "sair.", "Parar", "STOP", "descadastrar", "Não quero mais"]) expect(isOptOutText(text)).toBe(true);
    for (const text of ["vou sair às 18h", "não pare de me mandar ofertas", "", null]) expect(isOptOutText(text)).toBe(false);
  });

  it("janela de 24 h conta da última mensagem recebida", () => {
    const now = Date.parse("2026-10-30T12:00:00Z");
    expect(inServiceWindow("2026-10-29T12:00:01Z", now)).toBe(true);
    expect(inServiceWindow("2026-10-29T11:59:59Z", now)).toBe(false);
    expect(inServiceWindow(null, now)).toBe(false);
  });

  it("lê o corpo do template", () => {
    expect(templateBody([{ type: "HEADER", text: "x" }, { type: "BODY", text: "Olá {{1}}" }])).toBe("Olá {{1}}");
    expect(templateBody(null)).toBe("");
  });
});
