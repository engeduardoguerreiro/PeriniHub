// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signPayload } from "@/features/ai-sales/whatsapp/signature";

const processor = vi.hoisted(() => ({ ingestPayload: vi.fn(), processEvents: vi.fn() }));
vi.mock("@/features/ai-sales/whatsapp/processor", () => processor);
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));

const { GET, POST } = await import("./route");

const SECRET = "0123456789abcdef0123456789abcdef";
const VERIFY = "v".repeat(40);
const URL_BASE = "https://perinihub.com.br/api/ai-sales/webhooks/whatsapp";

beforeEach(() => {
  vi.stubEnv("AI_SALES_ENABLED", "true");
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
  vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", VERIFY);
  processor.ingestPayload.mockReset().mockResolvedValue({ received: 1, queued: ["e1"] });
});

describe("webhook do WhatsApp", () => {
  it("GET devolve o challenge só com o verify token certo", async () => {
    const ok = await GET(new NextRequest(`${URL_BASE}?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("12345");
    expect((await GET(new NextRequest(`${URL_BASE}?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1`))).status).toBe(403);
  });

  it("POST com assinatura inválida é recusado e nada é gravado", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const response = await POST(new NextRequest(URL_BASE, { method: "POST", body, headers: { "x-hub-signature-256": signPayload(body, "f".repeat(32)) } }));
    expect(response.status).toBe(401);
    expect(processor.ingestPayload).not.toHaveBeenCalled();
  });

  it("POST assinado grava e responde 200 sem processar na hora", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const response = await POST(new NextRequest(URL_BASE, { method: "POST", body, headers: { "x-hub-signature-256": signPayload(body, SECRET) } }));
    expect(response.status).toBe(200);
    expect(processor.ingestPayload).toHaveBeenCalledOnce();
    expect(processor.processEvents).not.toHaveBeenCalled();
  });

  it("sem configuração: 503; com o AI Sales desligado: 404", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body: "{}" }))).status).toBe(503);
    vi.stubEnv("AI_SALES_ENABLED", "false");
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body: "{}" }))).status).toBe(404);
  });
});
