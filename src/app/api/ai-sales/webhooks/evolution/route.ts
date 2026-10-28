import { after, NextResponse, type NextRequest } from "next/server";

import { evolutionPhoneNumberId, parseEvolutionWebhook } from "@/features/ai-sales/whatsapp/evolution";
import { ingestEvents, processEvents } from "@/features/ai-sales/whatsapp/processor";
import { safeEqual } from "@/features/ai-sales/whatsapp/signature";
import { isAiSalesEnabled, requireSecret } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

// Webhook do servidor Evolution (conexão não oficial, D-17). Autenticado pelo
// header x-webhook-secret definido na criação da instância. Mesmo caminho do
// webhook oficial: grava com dedupe, responde e processa depois.

const MAX_BODY = 1_000_000;

export async function POST(request: NextRequest) {
  if (!isAiSalesEnabled()) return new NextResponse(null, { status: 404 });
  let secret: string;
  try {
    secret = requireSecret("EVOLUTION_WEBHOOK_SECRET");
  } catch {
    return new NextResponse("Evolution não configurada", { status: 503 });
  }
  if (!safeEqual(request.headers.get("x-webhook-secret")?.trim() ?? null, secret)) return new NextResponse(null, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { events, connection } = parseEvolutionWebhook(body);
  if (connection) {
    const status = connection.state === "open" ? "active" : connection.state === "connecting" ? "syncing" : "error";
    await createSalesServiceClient().rpc("whatsapp_set_connection_state", { p_phone_number_id: evolutionPhoneNumberId(connection.numberId), p_status: status });
  }
  if (events.length) {
    const { queued } = await ingestEvents(events);
    if (queued.length) after(() => processEvents(queued).then(() => undefined));
  }
  return NextResponse.json({ ok: true });
}
