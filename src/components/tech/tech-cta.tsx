import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** Ponte entre o portal e os serviços comerciais. */
export function TechCta() {
  return (
    <aside className="relative isolate overflow-hidden rounded-2xl bg-ink-900 p-6 text-white sm:p-8">
      <span className="hero-glow absolute inset-0 -z-10 opacity-80" aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300">PeriniHub</p>
      <p className="font-display mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Tecnologia aplicada ao seu negócio
      </p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
        Além de acompanhar o mercado, desenvolvemos sites, sistemas web e automações sob medida.
        Orçamento com escopo e prazo em até 24 horas.
      </p>
      <Link
        href="/#contato"
        className="group mt-5 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-brand-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        Solicitar orçamento
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </aside>
  );
}
