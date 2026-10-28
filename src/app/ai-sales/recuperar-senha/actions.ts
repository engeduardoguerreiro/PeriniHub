"use server";

import { z } from "zod";

import { clientIpHash, consumeRateLimit, emailHash } from "@/features/ai-sales/auth/rate-limit";
import { requestOrigin } from "@/features/ai-sales/origin";
import { isAiSalesEnabled } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export type RecoverState = { error: string | null; sent: boolean };

/**
 * Envia o link de redefinição (fluxo PKCE: o link volta para
 * /ai-sales/auth/callback neste navegador). A resposta é sempre a mesma,
 * exista ou não a conta.
 */
export async function requestPasswordReset(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  if (!isAiSalesEnabled()) return { error: null, sent: true };
  const parsed = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Informe um e-mail válido.", sent: false };

  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`reset:ip:${await clientIpHash()}`, 3600, 10),
    consumeRateLimit(`reset:email:${emailHash(parsed.data)}`, 3600, 3),
  ]);
  if (!byIp || !byEmail) return { error: "Muitas solicitações. Tente de novo mais tarde.", sent: false };

  const supabase = await createSalesSessionClient();
  const redirectTo = `${await requestOrigin()}/ai-sales/auth/callback?next=/ai-sales/redefinir-senha`;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
  if (error && error.status !== 429) console.error("[ai-sales] falha ao pedir redefinição:", error.message);
  return { error: null, sent: true };
}
