import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { BrandMark } from "@/components/perinihub/brand";
import { EcosystemCard, FeatureCard, ProcessStep } from "@/components/perinihub/cards";
import { ContactForm } from "@/components/perinihub/contact-form";
import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { SectionTitle } from "@/components/perinihub/section-title";
import { WhatsAppFloatingButton } from "@/components/perinihub/whatsapp-floating-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  differentials,
  ecosystemCards,
  faq,
  heroSignals,
  processSteps,
  solutions,
  WHATSAPP_URL,
} from "@/lib/site";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <section
          id="inicio"
          className="aurora relative isolate px-5 pb-14 pt-28 sm:px-6 lg:px-8 lg:pb-16 lg:pt-32"
        >
          <div className="absolute inset-0 -z-10 grid-surface opacity-30" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-white/70" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.98fr_0.82fr]">
            <div>
              <Badge className="mb-5 bg-white text-zinc-800 shadow-sm hover:bg-white">
                Desenvolvimento de sites e sistemas
              </Badge>
              <h1 className="font-display text-balance text-4xl font-extrabold tracking-[-0.03em] text-zinc-950 sm:text-5xl lg:text-6xl">
                Sites e sistemas{" "}
                <span className="relative whitespace-nowrap">
                  sob medida
                  <span
                    className="absolute -bottom-1 left-0 h-[0.18em] w-full rounded-full bg-red-600/85"
                    aria-hidden="true"
                  />
                </span>{" "}
                para a sua empresa.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 sm:text-lg text-zinc-600">
                Criamos sites, sistemas de gestão e automações que organizam a operação
                e ajudam o seu negócio a vender mais. Orçamento em até 24 horas, sem compromisso.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="group rounded-md bg-red-600 shadow-lg shadow-red-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/30"
                >
                  <a href="#contato">
                    Solicitar orçamento
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-md bg-white/70">
                  <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                {heroSignals.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white/80 px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
                  >
                    <Icon className="h-4 w-4 text-red-600" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative hidden min-h-[430px] lg:block">
              <div className="absolute inset-0 rounded-lg border border-zinc-200/70 bg-white/35 shadow-[0_30px_90px_rgba(24,24,27,0.08)] backdrop-blur-sm" />
              <div className="absolute inset-6 grid-surface rounded-lg border border-zinc-200/60 bg-white/45" />
              <div className="absolute -top-5 right-10 z-10 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-800 shadow-xl">
                Orçamento em até 24h
              </div>
              <div className="absolute left-12 top-12 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-lg">
                  <BrandMark className="h-16 w-14" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-600">
                    PeriniHub
                  </p>
                  <p className="font-display mt-1 text-lg font-extrabold text-zinc-950">
                    Sites e sistemas
                  </p>
                </div>
              </div>
              <div className="absolute bottom-12 left-12 right-12 grid grid-cols-2 gap-3">
                {[
                  ["Sites", "Institucionais e landing pages"],
                  ["Sistemas", "Gestão sob medida"],
                  ["Painéis", "Indicadores em tempo real"],
                  ["Automações", "WhatsApp e integrações"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-zinc-200 bg-white/82 p-4 shadow-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg"
                  >
                    <p className="font-mono text-xs font-bold text-red-600">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-bold text-zinc-800">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-5 right-5 flex items-center gap-3 rounded-lg border border-red-100 bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-xl">
                <BrandMark className="h-9 w-8" />
                Suporte depois da entrega
              </div>
            </div>
          </div>
        </section>

        <AnimatedSection id="servicos" className="bg-white/62 px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Serviços"
              title="O que desenvolvemos para você"
              subtitle="Do site institucional ao sistema completo de gestão, tudo feito sob medida para a sua operação."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((solution) => (
                <FeatureCard key={solution.title} {...solution} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="diferenciais" className="px-5 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Por que a PeriniHub"
              title="Trabalho direto, prazo claro e preço fechado."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {differentials.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="processo" className="bg-zinc-950 px-5 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <SectionTitle
                align="left"
                eyebrow="Como trabalhamos"
                tone="dark"
                title="Do primeiro contato ao projeto no ar."
                subtitle="Um processo simples e transparente: você sabe exatamente em que etapa o seu projeto está."
              />
              <div className="relative grid gap-1 lg:grid-cols-4">
                <div className="absolute left-5 top-0 h-full w-px bg-white/15 lg:left-0 lg:top-5 lg:h-px lg:w-full" />
                {processSteps.map((step, index) => (
                  <ProcessStep key={step.title} index={index} tone="dark" {...step} />
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection
          id="produtos"
          className="relative isolate overflow-hidden bg-white/62 px-5 py-24 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 -z-10 grid-surface opacity-25" aria-hidden="true" />
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Produtos próprios"
              title="Não falamos só de tecnologia. Nós construímos."
              subtitle="Além dos projetos sob medida, desenvolvemos e mantemos nossos próprios sistemas SaaS — a mesma tecnologia que aplicamos no seu projeto."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {ecosystemCards.map((card) => (
                <EcosystemCard key={card.name} {...card} />
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/clientes"
                className="group inline-flex items-center gap-2 text-sm font-bold text-red-600 transition-colors hover:text-red-700"
              >
                <span className="link-underline">Conheça quem já trabalha com a gente</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="px-5 py-10 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-lg bg-zinc-950 p-7 text-white shadow-2xl shadow-zinc-950/20 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-600/20 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="font-display text-balance text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
                Vamos tirar seu projeto do papel?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-200">
                Conte o que você precisa e receba um orçamento com escopo e prazo em até 24 horas. Sem custo e sem compromisso.
              </p>
            </div>
            <div className="relative mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Button
                asChild
                size="lg"
                className="rounded-md bg-red-600 shadow-lg shadow-red-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700"
              >
                <a href="#contato">Solicitar orçamento</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-md transition-all duration-300 hover:-translate-y-0.5"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="duvidas" className="px-5 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionTitle eyebrow="Dúvidas frequentes" title="Perguntas que sempre recebemos" />
            <div className="mt-12 grid gap-4">
              {faq.map((item) => (
                <div
                  key={item.question}
                  className="rounded-lg border border-zinc-200 bg-white/86 p-6 shadow-sm transition-all duration-300 hover:border-red-200/80 hover:shadow-lg"
                >
                  <h3 className="font-display text-lg font-extrabold tracking-tight text-zinc-950">
                    {item.question}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="contato" className="bg-white/60 px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Orçamento"
              title="Conte o que você precisa"
              subtitle="Preencha os dados abaixo e receba um orçamento com escopo e prazo em até 24 horas."
            />
            <div className="mt-12">
              <ContactForm />
            </div>
          </div>
        </AnimatedSection>
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  );
}

