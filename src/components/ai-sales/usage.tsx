import { AlertTriangle } from "lucide-react";

import { formatMetric, METRIC_LABELS, type PlanMetric, type UsageRow, usageLevel, usagePercent, usageWarnings } from "@/features/ai-sales/billing/limits";
import { cn } from "@/lib/utils";

// Consumo × limite do plano. Sem estado: serve à tela do plano, ao dashboard
// e ao painel da plataforma.

const BAR: Record<string, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  full: "bg-red-500",
  blocked: "bg-muted-foreground/30",
};

export function UsageTable({ rows }: { rows: UsageRow[] }) {
  return (
    <ul className="grid gap-3">
      {rows.map((row) => {
        const level = usageLevel(row);
        const percent = usagePercent(row);
        return (
          <li key={row.metric} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{METRIC_LABELS[row.metric as PlanMetric] ?? row.metric}</span>
              <span className="text-muted-foreground">
                {level === "blocked" && !Number(row.used) ? (
                  "Não incluído no plano"
                ) : (
                  <>
                    {formatMetric(row.metric, Number(row.used))}
                    {Number(row.reserved) > 0 && ` (+${formatMetric(row.metric, Number(row.reserved))} reservado)`} de {formatMetric(row.metric, row.limit_value)}
                  </>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
              <div className={cn("h-full rounded-full", BAR[level])} style={{ width: `${level === "blocked" ? 0 : Math.max(percent, 2)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Aviso de limite (80% ou cheio). Nada quando está tudo dentro do plano. */
export function UsageWarnings({ rows, compact }: { rows: UsageRow[]; compact?: boolean }) {
  const warnings = usageWarnings(rows);
  if (!warnings.length) return null;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {warnings.map((row) => `${METRIC_LABELS[row.metric as PlanMetric] ?? row.metric} ${usagePercent(row)}%`).join(" · ")}
      </span>
    );
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Limite do plano próximo ou atingido</p>
        <ul className="mt-1">
          {warnings.map((row) => (
            <li key={row.metric}>
              {METRIC_LABELS[row.metric as PlanMetric] ?? row.metric}: {usagePercent(row)}%{row.level === "full" ? " — novas criações estão bloqueadas" : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
