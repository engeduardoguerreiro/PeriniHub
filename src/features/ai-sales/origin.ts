import "server-only";

import { headers } from "next/headers";

import { SITE_URL } from "@/lib/site";

/**
 * Origem pública da requisição atual (links de convite e de recuperação).
 * Em produção é sempre o domínio principal; em dev/preview, o host recebido.
 * O Supabase Auth ainda confere o redirect contra a lista de URLs permitidas.
 */
export async function requestOrigin() {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return SITE_URL;
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
