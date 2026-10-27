import { createClient } from "@supabase/supabase-js";

import { requirePublicEnv, requireSecret } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente com a secret key (papel service_role, ignora o RLS).
 * Uso exclusivo do worker do Trigger.dev. Sem `server-only` porque o worker
 * roda fora do Next; a chave não tem prefixo NEXT_PUBLIC, então nunca chega
 * ao bundle do navegador.
 */
export function createServiceClient() {
  const { supabaseUrl } = requirePublicEnv();
  return createClient<Database>(supabaseUrl, requireSecret("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
