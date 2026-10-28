import { createHmac, timingSafeEqual } from "node:crypto";

// Assinatura dos webhooks da Meta: header X-Hub-Signature-256 =
// "sha256=" + HMAC-SHA256(app secret, corpo bruto). Comparação em tempo
// constante; corpo precisa ser o texto exato recebido (antes do JSON.parse).

export function signPayload(rawBody: string, appSecret: string) {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header || !/^sha256=[0-9a-f]{64}$/.test(header)) return false;
  const expected = Buffer.from(signPayload(rawBody, appSecret));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Comparação em tempo constante para o verify token do GET de verificação. */
export function safeEqual(a: string | null, b: string) {
  if (a === null) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
