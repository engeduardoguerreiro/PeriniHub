import { Newspaper } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-6 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <Newspaper className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-display mt-4 text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/65">{children}</div>}
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-ink-900/8 bg-white", className)} aria-hidden="true">
      <div className="aspect-[16/9] animate-pulse bg-ink-900/8" />
      <div className="grid gap-3 p-5 sm:p-6">
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-900/8" />
        <div className="h-5 w-11/12 animate-pulse rounded bg-ink-900/10" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-ink-900/10" />
        <div className="h-3 w-full animate-pulse rounded bg-ink-900/6" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando notícias">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
