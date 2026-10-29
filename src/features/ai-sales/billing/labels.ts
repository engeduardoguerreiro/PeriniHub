import type { Database } from "@/lib/supabase/sales.types";

type Enums = Database["public"]["Enums"];

export const SUBSCRIPTION_STATUS_LABELS: Record<Enums["subscription_status"], string> = {
  internal: "interna",
  trial: "em teste",
  active: "ativa",
  past_due: "em atraso",
  canceled: "cancelada",
};

export const INVOICE_STATUS: Record<string, { tone: string; label: string }> = {
  draft: { tone: "internal", label: "Rascunho" },
  issued: { tone: "pending", label: "Emitida" },
  paid: { tone: "active", label: "Paga" },
  canceled: { tone: "closed", label: "Cancelada" },
};
