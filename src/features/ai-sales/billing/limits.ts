// Métricas do plano, formatação e avisos de limite. Puro (sem banco): usado
// pela tela do plano, pelo dashboard e pelo painel da plataforma.

export const PLAN_METRICS = ["members", "leads", "agents", "whatsapp_numbers", "capture_forms", "ai_cost_usd", "whatsapp_messages"] as const;
export type PlanMetric = (typeof PLAN_METRICS)[number];

export const METRIC_LABELS: Record<PlanMetric, string> = {
  members: "Membros (com convites pendentes)",
  leads: "Leads ativos",
  agents: "Agentes de IA",
  whatsapp_numbers: "Números de WhatsApp",
  capture_forms: "Formulários de captação",
  ai_cost_usd: "Custo de IA no mês (US$)",
  whatsapp_messages: "Mensagens de WhatsApp no mês",
};

export type UsageRow = { metric: string; kind: string; used: number; reserved: number; limit_value: number | null };

/** Aviso a partir de 80% do limite; bloqueio no limite (o banco recusa). */
export const WARNING_RATIO = 0.8;

export type UsageLevel = "ok" | "warning" | "full" | "blocked";

export function usageLevel(row: Pick<UsageRow, "used" | "reserved" | "limit_value">): UsageLevel {
  if (row.limit_value === null || row.limit_value === undefined) return "blocked";
  const total = Number(row.used) + Number(row.reserved);
  if (Number(row.limit_value) === 0) return total > 0 ? "full" : "blocked";
  const ratio = total / Number(row.limit_value);
  if (ratio >= 1) return "full";
  return ratio >= WARNING_RATIO ? "warning" : "ok";
}

export function usagePercent(row: Pick<UsageRow, "used" | "reserved" | "limit_value">) {
  if (!row.limit_value) return 0;
  return Math.min(100, Math.round(((Number(row.used) + Number(row.reserved)) / Number(row.limit_value)) * 100));
}

/** Métricas em aviso ou cheias (métrica bloqueada por plano não é aviso: é escolha do plano). */
export function usageWarnings(rows: UsageRow[]) {
  return rows
    .map((row) => ({ ...row, level: usageLevel(row) }))
    .filter((row): row is UsageRow & { level: "warning" | "full" } => row.level === "warning" || row.level === "full");
}

export function formatMetric(metric: string, value: number | null) {
  if (value === null) return "—";
  if (metric === "ai_cost_usd") return `US$ ${Number(value).toFixed(2)}`;
  return new Intl.NumberFormat("pt-BR").format(Number(value));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Preço nunca aparece como definitivo sem estar marcado assim no plano. */
export function formatPlanPrice(cents: number | null, isFinal: boolean) {
  if (cents === null) return "Preço a definir";
  return `${brl.format(cents / 100)}/mês${isFinal ? "" : " (provisório)"}`;
}

export function formatCentsBRL(cents: number) {
  return brl.format(cents / 100);
}

/** "10.5" / "10,5" → número; vazio → null; inválido → NaN. */
export function parseLimit(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

/** Lê os campos limit_<métrica> de um formulário; vazio = sem limite (métrica bloqueada) ou sem override. */
export function limitsFromForm(formData: FormData): { ok: true; limits: Record<string, number> } | { ok: false; error: string } {
  const limits: Record<string, number> = {};
  for (const metric of PLAN_METRICS) {
    const value = parseLimit(formData.get(`limit_${metric}`));
    if (value === null) continue;
    if (Number.isNaN(value)) return { ok: false, error: `Valor inválido em "${METRIC_LABELS[metric]}".` };
    limits[metric] = value;
  }
  return { ok: true, limits };
}
