import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { BrandMark, LogoPanel } from "@/components/perinihub/brand";
import { EcosystemCard, FeatureCard, ProcessStep } from "@/components/perinihub/cards";
import { ContactForm } from "@/components/perinihub/contact-form";
import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { SectionTitle } from "@/components/perinihub/section-title";
import { WhatsAppFloatingButton } from "@/components/perinihub/whatsapp-floating-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ecosystemCards,
  heroSignals,
  positioningCards,
  processSteps,
  reasons,
  solutions,
  WHATSAPP_URL,
} from "@/lib/site";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <section id="inicio" className="relative px-5 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-40">
          <div className="absolute inset-0 -z-10 grid-surface opacity-35" />
          <div className="absolute left-0 top-28 -z-10 h-64 w-64 rounded-full bg-red-600/8 blur-3xl" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <Badge className="mb-6 bg-white text-zinc-800 shadow-sm hover:bg-white">
                Empresa guarda-chuva digital da marca Perini
              </Badge>
              <h1 className="text-balance text-5xl font-black tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl">
                PERINIHUB
                <span className="mt-4 block text-3xl leading-tight text-zinc-800 sm:text-4xl lg:text-5xl">
                  Ecossistema de tecnologia, SaaS e soluções digitais para negócios em crescimento.
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-9 text-zinc-600">
                Criamos, conectamos e escalamos produtos digitais, plataformas web, automações e sistemas sob medida para transformar operação em resultado.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-md bg-zinc-950 hover:bg-red-700">
                  <a href="#solucoes">
                    Conhecer soluções
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-md bg-white/70">
                  <a href="#contato">Falar com especialista</a>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                {heroSignals.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white/80 px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                  >
                    <Icon className="h-4 w-4 text-red-600" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-5 -top-7 hidden rotate-[-8deg] rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-800 shadow-xl md:flex">
                Inteligência Operacional
              </div>
              <LogoPanel />
              <div className="absolute -bottom-5 right-5 flex items-center gap-3 rounded-lg border border-red-100 bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-xl">
                <BrandMark className="h-9 w-8" />
                SaaS em validação
              </div>
            </div>
          </div>
        </section>

        <AnimatedSection className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Posicionamento"
              title="Um hub para transformar ideias em produtos digitais reais."
              subtitle="A PeriniHub nasce para centralizar iniciativas digitais, SaaS e soluções tecnológicas com foco em validação rápida, operação simples e crescimento sustentável."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {positioningCards.map((card) => (
                <FeatureCard key={card.title} {...card} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="ecossistema" className="bg-white/62 px-5 py-20 sm:px-6 lg:px-8">
          <div id="produtos" className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Produtos"
              title="Ecossistema PeriniHub"
              subtitle="Diferentes soluções digitais conectadas por uma visão: simplificar operações e gerar novas fontes de receita."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {ecosystemCards.map((card) => (
                <EcosystemCard key={card.name} {...card} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="solucoes" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle title="Soluções digitais para empresas que querem operar melhor." />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((solution) => (
                <FeatureCard key={solution.title} {...solution} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="bg-zinc-950 px-5 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <SectionTitle
                align="left"
                eyebrow="Como trabalhamos"
                tone="dark"
                title="Processo simples, claro e preparado para evoluir."
                subtitle="A execução começa pelo essencial: entender o problema, reduzir ruído e construir uma versão que possa ganhar tração."
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

        <AnimatedSection className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionTitle
                align="left"
                eyebrow="Por que a PeriniHub"
                title="Tecnologia aplicada ao negócio, sem estruturas desnecessariamente complexas."
                subtitle="A PeriniHub une visão comercial, tecnologia e execução prática para tirar projetos do papel sem criar estruturas desnecessariamente complexas."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white/82 p-4 text-sm font-semibold text-zinc-800 shadow-sm"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="px-5 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-lg bg-zinc-950 p-7 text-white shadow-2xl shadow-zinc-950/12 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
                Tem uma ideia de sistema, SaaS ou plataforma digital?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-200">
                Vamos transformar sua ideia em um produto simples, validável e pronto para evoluir.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Button asChild size="lg" className="rounded-md bg-red-600 hover:bg-red-700">
                <a href="#contato">Solicitar conversa</a>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-md">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  Enviar ideia pelo WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="sobre" className="px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <SectionTitle
                align="left"
                eyebrow="Sobre"
                title="Sobre a PeriniHub"
                subtitle="A PeriniHub é o braço digital da marca Perini, criado para desenvolver soluções tecnológicas, produtos SaaS e plataformas digitais com foco em eficiência, recorrência e crescimento. Nosso objetivo é construir um ecossistema de produtos e serviços digitais que ajudem empresas a vender mais, operar melhor e criar novas oportunidades."
              />
            </div>
            <div className="grid gap-4">
              {[
                "Marca guarda-chuva",
                "Produtos digitais próprios",
                "Soluções sob demanda",
                "Foco em tecnologia aplicada ao negócio",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white/86 p-5 font-bold text-zinc-900 shadow-sm">
                  {item}
                  <ChevronRight className="h-5 w-5 text-red-600" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection id="contato" className="bg-white/60 px-5 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="Contato"
              title="Vamos construir algo juntos?"
              subtitle="Envie sua ideia, necessidade ou desafio. A PeriniHub pode ajudar a transformar isso em uma solução digital."
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
