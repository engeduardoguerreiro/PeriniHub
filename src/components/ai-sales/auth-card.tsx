import type { ReactNode } from "react";

import { Brand } from "@/components/perinihub/brand";

/** Moldura das telas públicas do AI Sales (login, recuperação, convite). */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main id="conteudo" className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-ink-950 px-4 py-16">
      <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Brand tone="dark" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300">AI Sales</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-[0_20px_60px_-30px_rgb(0_0_0/0.6)] sm:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}

export function FormFallback() {
  return <div className="h-56 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Carregando" />;
}
