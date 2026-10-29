import { NextResponse, type NextRequest } from "next/server";

import { clientIpHash, consumeRateLimit } from "@/features/ai-sales/auth/rate-limit";
import { loadPublicForm, PUBLIC_KEY_PATTERN, submitPublicForm } from "@/features/ai-sales/capture/public-form";
import { isHoneypotFilled, MAX_SUBMISSION_BYTES, parseSubmission, SUBMIT_MESSAGES, submissionHash, toRecord } from "@/features/ai-sales/capture/submission";
import { isAiSalesEnabled } from "@/lib/env";

// Captação pública. Aceita o <form> nativo (responde 303 de volta à página do
// formulário) e fetch com JSON (responde JSON). Sem sessão e fora do proxy;
// defesas: limite de tamanho, honeypot, limite por IP e por formulário, e a
// função do banco confere formulário ativo e versão do consentimento.

const IP_WINDOW = 600;
const IP_MAX = 8;
const FORM_WINDOW = 3600;
const FORM_MAX = 300;

type Outcome = { ok: boolean; message: string; status: number; code?: string };

function respond(request: NextRequest, key: string, wantsJson: boolean, outcome: Outcome) {
  if (wantsJson) return NextResponse.json({ ok: outcome.ok, message: outcome.message }, { status: outcome.status });
  const target = new URL(`/ai-sales/f/${key}`, request.nextUrl.origin);
  target.searchParams.set(outcome.ok ? "enviado" : "erro", outcome.ok ? "1" : (outcome.code ?? "error"));
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest, { params }: RouteContext<"/api/ai-sales/forms/[formId]">) {
  if (!isAiSalesEnabled()) return new NextResponse(null, { status: 404 });
  const { formId: key } = await params;
  if (!PUBLIC_KEY_PATTERN.test(key)) return new NextResponse(null, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";
  const wantsJson = contentType.includes("application/json") || (request.headers.get("accept") ?? "").includes("application/json");
  const fail = (code: keyof typeof SUBMIT_MESSAGES, status: number) => respond(request, key, wantsJson, { ok: false, code, message: SUBMIT_MESSAGES[code], status });

  if (!contentType.includes("application/json") && !contentType.includes("application/x-www-form-urlencoded")) return fail("invalid", 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_SUBMISSION_BYTES) return fail("invalid", 413);
  const raw = await request.text();
  if (raw.length > MAX_SUBMISSION_BYTES) return fail("invalid", 413);

  let input: Record<string, unknown>;
  try {
    input = contentType.includes("application/json") ? toRecord(JSON.parse(raw)) : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return fail("invalid", 400);
  }

  const form = await loadPublicForm(key);
  if (!form) return fail("form_unavailable", 404);

  // Robô: resposta de sucesso, nada gravado.
  if (isHoneypotFilled(input)) return respond(request, key, wantsJson, { ok: true, message: form.successMessage, status: 200 });

  const ipHash = await clientIpHash();
  const [ipAllowed, formAllowed] = await Promise.all([
    consumeRateLimit(`form-ip:${ipHash}`, IP_WINDOW, IP_MAX),
    consumeRateLimit(`form:${key}`, FORM_WINDOW, FORM_MAX),
  ]);
  if (!ipAllowed || !formAllowed) return fail("rate_limited", 429);

  const parsed = parseSubmission(input, form.fields);
  if (!parsed.ok) return respond(request, key, wantsJson, { ok: false, code: "invalid", message: parsed.error, status: 400 });

  const outcome = await submitPublicForm(form, parsed.data, {
    payloadHash: submissionHash(parsed.data, key),
    ipHash,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (outcome.ok) return respond(request, key, wantsJson, { ok: true, message: outcome.message, status: 200 });
  const status = outcome.code === "form_unavailable" ? 404 : outcome.code === "error" ? 500 : 400;
  return respond(request, key, wantsJson, { ok: false, code: outcome.code, message: outcome.message, status });
}
