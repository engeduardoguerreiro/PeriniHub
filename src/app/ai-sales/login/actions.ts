"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isPlatformAdmin } from "@/features/ai-sales/auth/dal";
import { clientIpHash, consumeRateLimit, emailHash } from "@/features/ai-sales/auth/rate-limit";
import { AI_SALES_HOME, AI_SALES_LOGIN, AI_SALES_PLATFORM, safeNextPath } from "@/features/ai-sales/paths";
import { isAiSalesEnabled } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export type LoginState = { error: string | null; email: string };

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
});

// Mensagem única para e-mail inexistente, senha errada ou conta sem empresa:
// não revela quais contas existem.
const INVALID = "E-mail ou senha inválidos, ou conta sem acesso ao AI Sales.";
const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAiSalesEnabled()) return { error: INVALID, email: "" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(formData.get("next"));
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: INVALID, email };

  // Por IP (vários e-mails) e por e-mail (vários IPs), em janelas de 15 min.
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`login:ip:${await clientIpHash()}`, 900, 30),
    consumeRateLimit(`login:email:${emailHash(email)}`, 900, 8),
  ]);
  if (!byIp || !byEmail) return { error: TOO_MANY, email };

  const supabase = await createSalesSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.status === 429) return { error: TOO_MANY, email };
    return { error: INVALID, email };
  }

  // Conta sem empresa e sem papel de plataforma não entra.
  // Mesmo cliente do login: já carrega a sessão recém-criada.
  const [{ count }, platformAdmin] = await Promise.all([
    supabase.from("organization_members").select("tenant_id", { count: "exact", head: true }).eq("user_id", data.user.id).eq("status", "active"),
    isPlatformAdmin(data.user.id),
  ]);
  // Exceção: quem chega por um link de convite entra para poder aceitá-lo.
  if (!count && !platformAdmin && !next.startsWith("/ai-sales/convite/")) {
    await supabase.auth.signOut();
    return { error: INVALID, email };
  }

  redirect(next !== AI_SALES_HOME ? next : !count ? AI_SALES_PLATFORM : AI_SALES_HOME);
}

export async function signOut() {
  const supabase = await createSalesSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(AI_SALES_LOGIN);
}
