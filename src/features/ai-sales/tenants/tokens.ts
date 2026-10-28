import { createHash, randomBytes } from "node:crypto";

// Tokens de convite: 32 bytes aleatórios em base64url (43 caracteres). O
// banco guarda só o SHA-256; o token aparece uma vez para quem convidou.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isInviteTokenFormat(token: string) {
  return TOKEN_PATTERN.test(token);
}
