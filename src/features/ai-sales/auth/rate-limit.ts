import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createSalesServiceClient } from "@/lib/supabase/sales-service";

// Limite de tentativas no Postgres (função consume_rate_limit), chamado só
// pelo servidor com a secret key. Complementa os limites do Supabase Auth.

/** Hash do IP do cliente com sal: identifica a origem sem guardar o IP. */
export async function clientIpHash() {
  const list = await headers();
  // Na Vercel, x-forwarded-for é definido pela plataforma (primeiro item = cliente).
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "desconhecido";
  return createHash("sha256")
    .update(`${process.env.AI_SALES_IP_HASH_SALT ?? "ai-sales"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export function emailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/**
 * Consome uma tentativa. Falha ao consultar o banco não bloqueia o usuário
 * (os limites do Supabase Auth continuam valendo), mas fica registrada.
 */
export async function consumeRateLimit(key: string, windowSeconds: number, max: number) {
  try {
    const { data, error } = await createSalesServiceClient().rpc("consume_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.error("[ai-sales] limitador indisponível:", error instanceof Error ? error.message : error);
    return true;
  }
}
