import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  /** Monta o href de uma página (a página 1 deve apontar para a URL sem ?pagina). */
  hrefFor: (page: number) => string;
};

/** Janela de páginas ao redor da atual, com reticências nas pontas. */
export function pageWindow(page: number, pageCount: number, radius = 1): (number | "…")[] {
  const pages = new Set([1, pageCount]);
  for (let n = page - radius; n <= page + radius; n++) if (n >= 1 && n <= pageCount) pages.add(n);
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) result.push("…");
    result.push(n);
  });
  return result;
}

const itemClass =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Paginação" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(itemClass, "border-ink-900/10 bg-white hover:border-brand-200")}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </Link>
      )}
      {pageWindow(page, pageCount).map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-ink-900/50" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Página ${item}`}
            className={cn(
              itemClass,
              item === page ? "border-ink-900 bg-ink-900 text-white" : "border-ink-900/10 bg-white hover:border-brand-200",
            )}
          >
            {item}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(itemClass, "border-ink-900/10 bg-white hover:border-brand-200")}>
          Próxima
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}

/** Lê ?pagina= com tolerância: qualquer valor inválido vira página 1. */
export function parsePageParam(raw: string | string[] | undefined) {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 1 && value <= 1000 ? value : 1;
}
