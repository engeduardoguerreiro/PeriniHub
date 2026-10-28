import { ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, ShieldX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { STAGE_COLORS, type StageColor } from "@/features/ai-sales/crm/labels";
import { PAGE_SIZE } from "@/features/ai-sales/crm/page-size";
import { cn } from "@/lib/utils";

import { buttonClass } from "./button-styles";
import { inputClass } from "./ui";

// Componentes de servidor do CRM: filtros por GET (funcionam sem JS),
// paginação, selos de etapa e de consentimento.

export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form method="get" action={action} role="search" className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-3">
      {children}
      <button type="submit" className={buttonClass("secondary")}>
        <Search className="h-4 w-4" aria-hidden="true" />
        Filtrar
      </button>
      <Link href={action} className="text-sm font-medium text-muted-foreground hover:text-foreground">
        Limpar
      </Link>
    </form>
  );
}

export function SearchInput({ value, placeholder }: { value: string; placeholder: string }) {
  return (
    <label className="grid min-w-48 flex-1 gap-1 text-xs font-medium text-muted-foreground">
      Busca
      <input type="search" name="q" defaultValue={value} placeholder={placeholder} maxLength={80} className={`${inputClass} h-9`} />
    </label>
  );
}

export function SelectFilter({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select name={name} defaultValue={value} className={`${inputClass} h-9 w-auto`}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({ page, total, basePath, params }: { page: number; total: number; basePath: string; params: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const search = new URLSearchParams(Object.entries({ ...params, pagina: String(target) }).filter(([, value]) => value));
    return `${basePath}?${search.toString()}`;
  };
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {first}–{last} de {total.toLocaleString("pt-BR")}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass("secondary")} rel="prev">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonClass("secondary")} rel="next">
            Próxima <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function StageBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
      <span className={cn("h-2 w-2 rounded-full", STAGE_COLORS[color as StageColor] ?? STAGE_COLORS.slate)} aria-hidden="true" />
      {name}
    </span>
  );
}

/**
 * Situação de contato por WhatsApp, separada da etapa comercial: autorizado
 * só com consentimento vigente e sem supressão.
 */
export function ContactPermission({ authorized, suppressed }: { authorized: boolean; suppressed: boolean }) {
  if (suppressed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-400/15 dark:text-red-200">
        <ShieldX className="h-3.5 w-3.5" aria-hidden="true" /> Descadastrado
      </span>
    );
  }
  if (authorized) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp autorizado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Sem autorização
    </span>
  );
}

export function DataTable({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-4 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
