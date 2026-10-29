import type { Database } from "@/lib/supabase/sales.types";

// Estado do formulário → selo da UI (reaproveita as cores do StatusBadge).
export const FORM_STATUS: Record<Database["public"]["Enums"]["capture_form_status"], { tone: string; label: string }> = {
  draft: { tone: "internal", label: "Rascunho" },
  active: { tone: "active", label: "Publicado" },
  paused: { tone: "suspended", label: "Pausado" },
};
