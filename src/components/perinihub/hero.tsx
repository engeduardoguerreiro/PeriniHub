import { ArrowRight, MessageCircle } from "lucide-react";

import { HubDiagram } from "@/components/perinihub/hub-diagram";
import { Button } from "@/components/ui/button";
import { heroStats, WHATSAPP_URL } from "@/lib/site";

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden bg-ink-950 px-4 pb-16 pt-28 text-white sm:px-6 sm:pt-32 lg:px-8 lg:pb-20 lg:pt-36"
    >
      <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 sm:text-sm">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="node-pulse absolute inline-flex h-full w-full rounded-full bg-aqua-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua-400" />
            </span>
            Software house com produtos SaaS próprios
          </p>

          <h1 className="font-display mt-6 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]">
            Sites e sistemas <span className="text-gradient-brand">sob medida</span> para a sua
            empresa crescer.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
            Criamos sites, sistemas de gestão e automações que organizam a operação e ajudam o
            seu negócio a vender mais. Você fala direto com quem desenvolve.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full bg-brand-600 px-6 text-base text-white shadow-[0_10px_30px_-6px_rgb(22_119_255/0.6)] hover:bg-brand-700"
            >
              <a href="#contato">
                Solicitar orçamento
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Falar no WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6">
            {heroStats.map((stat) => (
              // Valor em cima e rótulo embaixo, mantendo a ordem dt → dd no HTML.
              <div key={stat.label} className="flex flex-col-reverse justify-end px-3 first:pl-0 sm:px-5">
                <dt className="mt-1 text-xs leading-5 text-white/60 sm:text-sm">{stat.label}</dt>
                <dd className="font-display text-2xl font-semibold text-white sm:text-3xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto hidden w-full max-w-xl md:block">
          <HubDiagram />
        </div>
      </div>
    </section>
  );
}
