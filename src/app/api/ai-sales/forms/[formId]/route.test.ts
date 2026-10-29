// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publicForm = vi.hoisted(() => ({ loadPublicForm: vi.fn(), submitPublicForm: vi.fn(), PUBLIC_KEY_PATTERN: /^[a-z0-9]{32}$/ }));
const limiter = vi.hoisted(() => ({ clientIpHash: vi.fn(async () => "a".repeat(32)), consumeRateLimit: vi.fn(async () => true) }));
vi.mock("@/features/ai-sales/capture/public-form", () => publicForm);
vi.mock("@/features/ai-sales/auth/rate-limit", () => limiter);

const { POST } = await import("./route");

const KEY = "0123456789abcdef0123456789abcdef";
const URL_BASE = `https://perinihub.com.br/api/ai-sales/forms/${KEY}`;
const FORM = { key: KEY, organization: "Org", headline: "Fale", description: null, fields: ["phone", "email"], consentText: "x".repeat(30), consentVersion: 1, successMessage: "Obrigado!" };
const ctx = (key = KEY) => ({ params: Promise.resolve({ formId: key }) });

const json = (body: unknown) =>
  new NextRequest(URL_BASE, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const native = (body: string) =>
  new NextRequest(URL_BASE, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });

beforeEach(() => {
  vi.stubEnv("AI_SALES_ENABLED", "true");
  publicForm.loadPublicForm.mockReset().mockResolvedValue(FORM);
  publicForm.submitPublicForm.mockReset().mockResolvedValue({ ok: true, message: "Obrigado!" });
  limiter.consumeRateLimit.mockReset().mockResolvedValue(true);
});

describe("rota pública de formulários", () => {
  it("JSON válido grava e responde 200", async () => {
    const response = await POST(json({ full_name: "Maria", phone: "11975418690", consent: true, consent_version: 1 }), ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, message: "Obrigado!" });
    const [, data, meta] = publicForm.submitPublicForm.mock.calls[0];
    expect(data).toMatchObject({ phone: "+5511975418690", consent: true });
    expect(meta.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("form nativo volta para a página com 303", async () => {
    const ok = await POST(native("full_name=Maria&email=m%40x.com&consent_version=1"), ctx());
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(`https://perinihub.com.br/ai-sales/f/${KEY}?enviado=1`);
    const bad = await POST(native("full_name=Maria&consent_version=1"), ctx());
    expect(bad.headers.get("location")).toContain("erro=invalid");
  });

  it("honeypot preenchido: finge sucesso e não grava nem consome limite", async () => {
    const response = await POST(json({ full_name: "Bot", email: "b@x.com", consent_version: 1, site_empresa: "http://spam" }), ctx());
    expect(response.status).toBe(200);
    expect(publicForm.submitPublicForm).not.toHaveBeenCalled();
    expect(limiter.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("limite de envios: 429 sem gravar", async () => {
    limiter.consumeRateLimit.mockResolvedValueOnce(false);
    const response = await POST(json({ full_name: "Maria", email: "m@x.com", consent_version: 1 }), ctx());
    expect(response.status).toBe(429);
    expect(publicForm.submitPublicForm).not.toHaveBeenCalled();
  });

  it("formulário inexistente, chave malformada, tipo e tamanho", async () => {
    publicForm.loadPublicForm.mockResolvedValueOnce(null);
    expect((await POST(json({ full_name: "Maria", email: "m@x.com", consent_version: 1 }), ctx())).status).toBe(404);
    expect((await POST(json({}), ctx("../../x"))).status).toBe(404);
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body: "a", headers: { "content-type": "text/plain", accept: "application/json" } }), ctx())).status).toBe(415);
    expect((await POST(json({ full_name: "x".repeat(20_000) }), ctx())).status).toBe(413);
    expect((await POST(new NextRequest(URL_BASE, { method: "POST", body: "{", headers: { "content-type": "application/json" } }), ctx())).status).toBe(400);
  });

  it("AI Sales desligado: 404", async () => {
    vi.stubEnv("AI_SALES_ENABLED", "false");
    expect((await POST(json({}), ctx())).status).toBe(404);
  });
});
