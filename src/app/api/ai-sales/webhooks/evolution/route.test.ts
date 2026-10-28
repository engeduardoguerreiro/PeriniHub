// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processor = vi.hoisted(() => ({ ingestEvents: vi.fn(), processEvents: vi.fn() }));
vi.mock("@/features/ai-sales/whatsapp/processor", () => processor);
vi.mock("@/lib/supabase/sales-service", () => ({ createSalesServiceClient: () => ({ rpc: vi.fn().mockResolvedValue({ error: null }) }) }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));

const { POST } = await import("./route");

const SECRET = "s".repeat(40);
const URL_BASE = "https://perinihub.com.br/api/ai-sales/webhooks/evolution";
const body = JSON.stringify({ event: "messages.upsert", instance: "ais-11111111-2222-4333-8444-555555555555", data: { key: { id: "X", remoteJid: "5511987654321@s.whatsapp.net" }, message: { conversation: "Oi" } } });

beforeEach(() => {
  vi.stubEnv("AI_SALES_ENABLED", "true");
  vi.stubEnv("EVOLUTION_WEBHOOK_SECRET", SECRET);
  processor.ingestEvents.mockReset().mockResolvedValue({ received: 1, queued: ["e1"] });
});

describe("webhook da Evolution", () => {
  it("sem o segredo certo: 401 e nada gravado", async () => {
    for (const headers of [{}, { "x-webhook-secret": "errado" }]) {
      expect((await POST(new NextRequest(URL_BASE, { method: "POST", body, headers }))).status).toBe(401);
    }
    expect(processor.ingestEvents).not.toHaveBeenCalled();
  });

  it("com o segredo: grava o evento normalizado e responde 200", async () => {
    const response = await POST(new NextRequest(URL_BASE, { method: "POST", body, headers: { "x-webhook-secret": SECRET } }));
    expect(response.status).toBe(200);
    expect(processor.ingestEvents).toHaveBeenCalledWith([expect.objectContaining({ kind: "message", contactPhone: "+5511987654321" })]);
  });

  it("sem configuração: 503; AI Sales desligado: 404", async () => {
    vi.stubEnv("EVOLUTION_WEBHOOK_SECRET", "");
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body }))).status).toBe(503);
    vi.stubEnv("AI_SALES_ENABLED", "false");
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body }))).status).toBe(404);
  });
});
