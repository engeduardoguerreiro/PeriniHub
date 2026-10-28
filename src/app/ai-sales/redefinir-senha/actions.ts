"use server";

import { redirect } from "next/navigation";

import { requireSalesUser } from "@/features/ai-sales/auth/dal";
import { firstIssue, newPasswordSchema } from "@/features/ai-sales/auth/password";
import { AI_SALES_HOME } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export type ResetState = { error: string | null };

export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await requireSalesUser();
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSalesSessionClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "A nova senha precisa ser diferente da atual." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use uma combinação mais longa e variada." };
    return { error: "Não foi possível salvar a senha. Peça um novo link e tente de novo." };
  }
  redirect(AI_SALES_HOME);
}
