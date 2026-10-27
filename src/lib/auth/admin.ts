import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSessionClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "editor";
export type AdminUser = { id: string; email: string | null; role: AdminRole };

export const LOGIN_PATH = "/admin/login";

/**
 * Usuário logado com papel editorial, ou null. `getClaims()` valida a
 * assinatura do JWT (não confia só no cookie); o papel vem do banco via RLS,
 * nunca de algo que o cliente envie. `cache` deduplica dentro da requisição.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", data.claims.sub)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    role: profile.role,
  };
});

/** Exige admin ou editor; senão redireciona ao login. Usar em páginas, actions e route handlers. */
export async function requireEditor(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Exige papel admin (configurações, fontes, modelos, papéis). */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await requireEditor();
  if (user.role !== "admin") redirect(`${LOGIN_PATH}?erro=permissao`);
  return user;
}
