import { after, NextResponse, type NextRequest } from "next/server";

import { processEvents, ingestPayload } from "@/features/ai-sales/whatsapp/processor";
import { safeEqual, verifySignature } from "@/features/ai-sales/whatsapp/signature";
import { isAiSalesEnabled, requireSecret } from "@/lib/env";
import { readBodyLimited } from "@/lib/security/read-body";

// Webhook da WhatsApp Cloud API.
// GET: verificação do endpoint pela Meta (hub.verify_token).
// POST: confere a assinatura sobre o corpo bruto, grava os eventos com
// deduplicação e responde 200 em seguida; o processamento roda depois da
// resposta (after) e é idempotente. Fica fora do proxy (sem sessão).

const MAX_BODY = 1_000_000;

function secret(name: "WHATSAPP_APP_SECRET" | "WHATSAPP_WEBHOOK_VERIFY_TOKEN") {
  try {
    return requireSecret(name);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!isAiSalesEnabled()) return new NextResponse(null, { status: 404 });
  const verifyToken = secret("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  if (!verifyToken) return new NextResponse("WhatsApp não configurado", { status: 503 });
  const params = request.nextUrl.searchParams;
  const challenge = params.get("hub.challenge") ?? "";
  if (params.get("hub.mode") === "subscribe" && safeEqual(params.get("hub.verify_token"), verifyToken) && /^[\w-]{1,200}$/.test(challenge)) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest) {
  if (!isAiSalesEnabled()) return new NextResponse(null, { status: 404 });
  const appSecret = secret("WHATSAPP_APP_SECRET");
  if (!appSecret) return new NextResponse("WhatsApp não configurado", { status: 503 });
  const raw = await readBodyLimited(request, MAX_BODY);
  if (raw === null) return new NextResponse(null, { status: 413 });
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    console.warn("[ai-sales] webhook do WhatsApp com assinatura inválida");
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const { queued } = await ingestPayload(payload);
    if (queued.length) after(() => processEvents(queued).then(() => undefined));
  } catch (error) {
    // Payload que não é do WhatsApp: 200 para a Meta não insistir, mas registrado.
    console.error("[ai-sales] webhook ignorado:", error instanceof Error ? error.message.slice(0, 200) : error);
  }
  return NextResponse.json({ ok: true });
}
