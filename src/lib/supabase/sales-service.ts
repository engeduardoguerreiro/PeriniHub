import { createClient } from "@supabase/supabase-js";

import { requireSalesPublicEnv, requireSecret } from "@/lib/env";

import type { Database } from "./sales.types";

/**
 * Cliente do AI Sales com a secret key (service_role, ignora o RLS). Só para
 * o servidor: ações de plataforma (depois de conferir o superadmin), limite
 * de tentativas, criação de conta pelo convite e, nas próximas fases, o
 * worker. Sem `server-only` porque o worker roda fora do Next; a chave não
 * tem prefixo NEXT_PUBLIC, então nunca chega ao bundle do navegador.
 */
export function createSalesServiceClient() {
  const { supabaseUrl } = requireSalesPublicEnv();
  return createClient<Database>(supabaseUrl, requireSecret("SALES_SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
