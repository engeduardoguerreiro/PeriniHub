import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/sales.types";

import type { UsageRow } from "./limits";

/** Consumo × limite de uma empresa (membros pela sessão; plataforma pela secret key). */
export async function loadUsage(db: SupabaseClient<Database>, tenantId: string): Promise<UsageRow[]> {
  const { data, error } = await db.rpc("organization_usage", { p_tenant: tenantId });
  if (error) throw new Error(`Falha ao ler o consumo: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, used: Number(row.used), reserved: Number(row.reserved), limit_value: row.limit_value === null ? null : Number(row.limit_value) }));
}
