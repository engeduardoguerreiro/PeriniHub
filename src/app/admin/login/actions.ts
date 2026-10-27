"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSessionClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; email: string };

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
});

// Mensagem única para e-mail inexistente, senha errada ou usuário sem papel:
// não revela quais contas existem.
const INVALID = "E-mail ou senha inválidos, ou usuário sem acesso ao painel.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: INVALID, email };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // 429 do Supabase Auth: limite de tentativas atingido.
    if (error?.status === 429) {
      return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.", email };
    }
    return { error: INVALID, email };
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: INVALID, email };
  }

  redirect("/admin/noticias");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
