import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

export type AgentContext = {
  db: Db;
  /** Id da execução no Trigger.dev (para cruzar logs com news_agent_runs). */
  runId?: string;
  /** Relógio injetável nos testes. */
  now?: () => number;
  log?: (message: string, data?: Record<string, unknown>) => void;
};

export type EditorialSettings = Database["public"]["Tables"]["news_editorial_settings"]["Row"];

export async function getSettings(db: Db): Promise<EditorialSettings> {
  const { data, error } = await db.from("news_editorial_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Configurações editoriais indisponíveis: ${error.message}`);
  return data;
}

/** Início do dia/mês no fuso editorial, em ISO (para contagens "de hoje"). */
export function startOf(unit: "day" | "month", timeZone: string, now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(now))
      .map((part) => [part.type, part.value]),
  );
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = localAsUtc - Math.floor(now / 1000) * 1000;
  const startLocal = Date.UTC(+parts.year, +parts.month - 1, unit === "day" ? +parts.day : 1);
  return new Date(startLocal - offset).toISOString();
}

/** "HH:MM" atual no fuso editorial. */
export function localTime(timeZone: string, now = Date.now()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now));
}

export function localDate(timeZone: string, now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}
