import type { Metadata } from "next";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { ClientCard, FeatureCard, ProcessStep, ProductCard } from "@/components/perinihub/cards";
import { ContactForm } from "@/components/perinihub/contact-form";
import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { Hero } from "@/components/perinihub/hero";
import { SectionTitle } from "@/components/perinihub/section-title";
import { sharedOpenGraph } from "@/lib/metadata";
import { clients, differentials, ecosystemCards, faq, jsonLd, processSteps, solutions } from "@/lib/site";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...sharedOpenGraph, url: "/" },
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="conteudo" className="flex-1">
        <Hero />

        <AnimatedSection id="servicos" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Serviços"
              title="O que desenvolvemos para você"
              subtitle="Do site institucional ao sistema completo de gestão, tudo feito sob medida para a sua operação."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {solutions.map((solution) => (
                <FeatureCard key={solution.title} {...solution} />
              ))}
              <a
                href="#contato"
                className="group relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl bg-ink-900 p-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:col-span-3"
              >
                <span className="hero-glow absolute inset-0 -z-10 opacity-80" aria-hidden="true" />
                <span>
                  <span className="block font-display text-xl font-semibold tracking-tight sm:text-2xl">
                    Não encontrou o que precisa?
                  </span>
                  <span className="mt-1 block text-sm text-white/70">
                    A maioria dos nossos projetos começa com um problema, não com uma especificação.
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-brand-300 group-hover:text-white">
                  Conte sua ideia para a gente
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </a>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection
          id="produtos"
          className="relative isolate overflow-hidden bg-ink-950 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="hero-glow absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              tone="dark"
              eyebrow="Produtos próprios"
              title="Não falamos só de tecnologia. Nós construímos."
              subtitle="Além dos projetos sob medida, desenvolvemos e mantemos nossos próprios SaaS, com a mesma tecnologia que aplicamos no seu projeto."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {ecosystemCards.map((card) => (
                <ProductCard key={card.name} {...card} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="processo" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Como trabalhamos"
              title="Do primeiro contato ao projeto no ar"
              subtitle="Um processo simples e transparente: você sabe exatamente em que etapa o seu projeto está."
            />
            <div className="relative mt-14">
              <span
                className="absolute bottom-10 left-6 top-6 w-px bg-gradient-to-b from-brand-400 to-aqua-400 lg:bottom-auto lg:left-6 lg:right-[calc(25%-1.5rem)] lg:top-6 lg:h-px lg:w-auto lg:bg-gradient-to-r"
                aria-hidden="true"
              />
              <ol className="relative grid lg:grid-cols-4">
                {processSteps.map((step, index) => (
                  <ProcessStep key={step.title} index={index} {...step} />
                ))}
              </ol>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="diferenciais" className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionTitle
                align="left"
                eyebrow="Por que a PeriniHub"
                title="Trabalho direto, prazo claro e preço fechado."
                subtitle="Sem intermediários e sem letras miúdas. Você sabe o que vai receber, quando e por quanto."
              />
              <Link
                href="/clientes"
                className="group mt-8 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="link-underline">Conheça quem já trabalha com a gente</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {differentials.map((item) => (
                <FeatureCard key={item.title} {...item} className="bg-background" />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="clientes" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionTitle eyebrow="Clientes" title="Projetos funcionando em operações reais" />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {clients.map((client) => (
                <ClientCard key={client.name} {...client} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="duvidas" className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }}
          />
          <div className="mx-auto max-w-3xl">
            <SectionTitle eyebrow="Dúvidas frequentes" title="Perguntas que sempre recebemos" />
            <div className="mt-12 divide-y divide-ink-900/8 rounded-2xl border border-ink-900/8 bg-background">
              {faq.map((item) => (
                <details key={item.question} className="group px-5 sm:px-6">
                  <summary className="cursor-pointer list-none rounded-md py-5 font-display text-base font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:text-lg [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.question}
                      <Plus
                        className="h-5 w-5 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-7 text-ink-900/70 sm:text-[15px]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="contato" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
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
    </>
  );
}
