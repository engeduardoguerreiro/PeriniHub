"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { requireSalesUser } from "@/features/ai-sales/auth/dal";
import { firstIssue, newPasswordSchema } from "@/features/ai-sales/auth/password";
import { clientIpHash, consumeRateLimit } from "@/features/ai-sales/auth/rate-limit";
import { orgPath } from "@/features/ai-sales/paths";
import { hashInviteToken, isInviteTokenFormat } from "@/features/ai-sales/tenants/tokens";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export type InviteState = { error: string | null };

/** Aceite com a conta já logada (o banco confere se o e-mail é o convidado). */
export async function acceptInvite(token: string): Promise<ActionResult> {
  await requireSalesUser();
  if (!isInviteTokenFormat(token)) return fail("Convite inválido.");
  const supabase = await createSalesSessionClient();
  const { data: slug, error } = await supabase.rpc("accept_invite", { p_token_hash: hashInviteToken(token) });
  if (error || !slug) return fail(dbMessage(error?.message));
  redirect(orgPath(slug));
}

const accountSchema = z.object({
  token: z.string().refine(isInviteTokenFormat),
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
});

/**
 * Cria a conta do convidado e aceita o convite. Quem tem o token recebeu o
 * link no e-mail convidado, por isso a conta nasce com o e-mail confirmado —
 * o mesmo princípio de um link mágico. Se a conta já existe, pede login.
 */
export async function createAccountAndAccept(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = accountSchema.safeParse({ token: formData.get("token"), fullName: formData.get("fullName") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const password = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!password.success) return { error: firstIssue(password.error) };

  if (!(await consumeRateLimit(`invite-account:ip:${await clientIpHash()}`, 3600, 10))) {
    return { error: "Muitas tentativas. Tente de novo mais tarde." };
  }

  const hash = hashInviteToken(parsed.data.token);
  const service = createSalesServiceClient();
  const { data: preview } = await service.rpc("get_invite_preview", { p_token_hash: hash });
  const invite = preview?.[0];
  if (!invite) return { error: "Convite inválido, expirado ou revogado." };

  const created = await service.auth.admin.createUser({
    email: invite.email,
    password: password.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (created.error) {
    if (created.error.code === "email_exists") return { error: "Já existe uma conta com este e-mail. Entre com sua senha para aceitar o convite." };
    if (created.error.code === "weak_password") return { error: "Senha fraca. Use uma combinação mais longa e variada." };
    console.error("[ai-sales] falha ao criar conta do convite:", created.error.message);
    return { error: "Não foi possível criar a conta. Tente de novo." };
  }

  const supabase = await createSalesSessionClient();
  const signIn = await supabase.auth.signInWithPassword({ email: invite.email, password: password.data.password });
  if (signIn.error) return { error: "Conta criada, mas não foi possível entrar. Use a tela de login." };

  const { data: slug, error } = await supabase.rpc("accept_invite", { p_token_hash: hash });
  if (error || !slug) return { error: dbMessage(error?.message) };
  await supabase.from("user_profiles").update({ full_name: parsed.data.fullName }).eq("user_id", created.data.user.id);
  redirect(orgPath(slug));
}
