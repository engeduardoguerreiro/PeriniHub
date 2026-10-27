import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente anônimo, sem cookies: pode rodar dentro de `"use cache"` e o RLS
 * garante que ele só enxerga categorias ativas e artigos publicados.
 * Retorna null quando o Supabase não está configurado (ex.: CI).
 */
export function createPublicClient() {
  const env = getPublicEnv();
  if (!env) return null;
  return createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
