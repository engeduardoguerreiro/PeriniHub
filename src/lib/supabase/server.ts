import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requirePublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente com a sessão do usuário logado (cookies). As consultas passam pelo
 * RLS com o papel do usuário: é o cliente de todas as ações do painel.
 * Criar um por requisição; nunca compartilhar entre requisições.
 */
export async function createSessionClient() {
  // cookies() primeiro: torna a rota dinâmica antes de qualquer validação,
  // então o build (inclusive no CI, sem credenciais) não executa este trecho.
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = requirePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}
