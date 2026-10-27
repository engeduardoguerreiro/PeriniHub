import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-900/65">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon; tone?: "default" | "warning" | "danger" }) {
  return (
    <div className="rounded-2xl border border-ink-900/8 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-900/60">{label}</p>
        {Icon && (
          <Icon
            className={cn("h-4 w-4", tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-brand-600")}
            aria-hidden="true"
          />
        )}
      </div>
      <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-900/55">{hint}</p>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-ink-900/8 bg-white", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/8 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          {description && <p className="text-xs text-ink-900/55">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-ink-900/8 text-ink-900/70" },
  needs_review: { label: "Em revisão", className: "bg-amber-100 text-amber-800" },
  blocked: { label: "Bloqueado", className: "bg-red-100 text-red-800" },
  approved: { label: "Aprovado", className: "bg-brand-100 text-brand-800" },
  scheduled: { label: "Agendado", className: "bg-violet-100 text-violet-800" },
  published: { label: "Publicado", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejeitado", className: "bg-ink-900/8 text-ink-900/60 line-through" },
  archived: { label: "Arquivado", className: "bg-ink-900/8 text-ink-900/60" },
  // candidatos
  new: { label: "Novo", className: "bg-ink-900/8 text-ink-900/70" },
  classified: { label: "Classificado", className: "bg-ink-900/8 text-ink-900/70" },
  duplicate: { label: "Duplicado", className: "bg-ink-900/8 text-ink-900/60" },
  discarded: { label: "Descartado", className: "bg-ink-900/8 text-ink-900/60" },
  eligible: { label: "Elegível", className: "bg-brand-100 text-brand-800" },
  drafted: { label: "Redigido", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-800" },
  dead_letter: { label: "Dead letter", className: "bg-red-100 text-red-800" },
  // verificação e execuções
  pending: { label: "Pendente", className: "bg-ink-900/8 text-ink-900/70" },
  verified: { label: "Verificado", className: "bg-emerald-100 text-emerald-800" },
  partially_verified: { label: "Parcial", className: "bg-amber-100 text-amber-800" },
  unverified: { label: "Não verificado", className: "bg-red-100 text-red-800" },
  running: { label: "Executando", className: "bg-brand-100 text-brand-800" },
  succeeded: { label: "Sucesso", className: "bg-emerald-100 text-emerald-800" },
  skipped: { label: "Ignorado", className: "bg-ink-900/8 text-ink-900/60" },
  supported: { label: "Comprovada", className: "bg-emerald-100 text-emerald-800" },
  partially_supported: { label: "Parcial", className: "bg-amber-100 text-amber-800" },
  unsupported: { label: "Sem suporte", className: "bg-red-100 text-red-800" },
  contradicted: { label: "Contradita", className: "bg-red-100 text-red-800" },
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-800" },
  error: { label: "Erro", className: "bg-red-100 text-red-800" },
  low: { label: "Risco baixo", className: "bg-ink-900/8 text-ink-900/70" },
  medium: { label: "Risco médio", className: "bg-amber-100 text-amber-800" },
  high: { label: "Risco alto", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const style = (status && STATUS_STYLES[status]) || { label: status ?? "—", className: "bg-ink-900/8 text-ink-900/70" };
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", style.className)}>{style.label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-8 text-center text-sm text-ink-900/55">{children}</p>;
}

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
export function formatUsd(value: number | string | null | undefined) {
  return usd.format(Number(value ?? 0));
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export function formatDateTimeShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-ink-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60";
export const labelClass = "text-sm font-medium text-ink-900";

export const AGENT_LABELS: Record<string, string> = {
  researcher: "Researcher",
  curator: "Curator",
  writer: "Writer",
  fact_checker: "Fact Checker",
  seo_editor: "SEO Editor",
  publisher: "Publisher",
  pipeline: "Pipeline",
};
