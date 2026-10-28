import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSalesPublicEnv } from "@/lib/env";

import type { Database } from "./sales.types";

/**
 * Cliente do AI Sales com a sessão do usuário (cookies). Todas as consultas
 * passam pelo RLS com o papel do usuário em cada empresa. Os cookies não
 * colidem com os do painel do portal: o nome inclui o ref do projeto.
 * Criar um por requisição; nunca compartilhar entre requisições.
 */
export async function createSalesSessionClient() {
  // cookies() primeiro: torna a rota dinâmica antes de validar as variáveis.
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = requireSalesPublicEnv();

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
