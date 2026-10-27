import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

// Assinatura HMAC das chamadas worker → site para invalidar o cache.
// O corpo inclui um timestamp: chamadas com mais de 5 minutos são recusadas
// (sem replay), e só tags do portal podem ser invalidadas.

export const MAX_SKEW_MS = 5 * 60 * 1000;

export const revalidateBodySchema = z.object({
  tags: z
    .array(z.string().regex(/^news:(list|categories|article:[a-z0-9]+(-[a-z0-9]+)*)$/))
    .min(1)
    .max(20),
  /** "max" = stale-while-revalidate (publicação); "expire" = some na hora (despublicação). */
  mode: z.enum(["max", "expire"]).default("max"),
  ts: z.number().int(),
});
export type RevalidateBody = z.infer<typeof revalidateBodySchema>;

export function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifySignature(body: string, signature: string | null, secret: string) {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(sign(body, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type VerifyOutcome = { ok: true; body: RevalidateBody } | { ok: false; status: 400 | 401; reason: string };

export function verifyRevalidateRequest(raw: string, signature: string | null, secret: string, now = Date.now()): VerifyOutcome {
  if (!verifySignature(raw, signature, secret)) return { ok: false, status: 401, reason: "assinatura inválida" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, reason: "JSON inválido" };
  }
  const parsed = revalidateBodySchema.safeParse(json);
  if (!parsed.success) return { ok: false, status: 400, reason: "corpo inválido" };
  if (Math.abs(now - parsed.data.ts) > MAX_SKEW_MS) return { ok: false, status: 401, reason: "requisição expirada" };
  return { ok: true, body: parsed.data };
}
