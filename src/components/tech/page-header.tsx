import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TechPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string | null;
  children?: ReactNode;
  className?: string;
};

/** Faixa escura do topo das páginas do portal (o header do site fica transparente sobre ela). */
export function TechPageHeader({ eyebrow, title, description, children, className }: TechPageHeaderProps) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-ink-950 px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:px-8", className)}>
      <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div className="mx-auto max-w-7xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300">
          <span className="h-1.5 w-1.5 rounded-full bg-aqua-400" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">
          {title}
        </h1>
        {description && <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{description}</p>}
        {children}
      </div>
    </div>
  );
}
