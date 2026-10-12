import type { Metadata } from "next";
import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { ClientCard } from "@/components/perinihub/cards";
import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { SectionTitle } from "@/components/perinihub/section-title";
import { Button } from "@/components/ui/button";
import { sharedOpenGraph } from "@/lib/metadata";
import { clients, WHATSAPP_URL } from "@/lib/site";

const title = "Clientes e projetos entregues";
const description =
  "Empresas que confiaram na PeriniHub para desenvolver seus sites, sistemas e automações.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/clientes" },
  openGraph: { ...sharedOpenGraph, title: `${title} | PeriniHub`, description, url: "/clientes" },
  twitter: { card: "summary_large_image", title: `${title} | PeriniHub`, description },
};

export default function ClientesPage() {
  return (
    <>
      <Header />
      <main id="conteudo" className="flex-1">
        <section className="relative isolate overflow-hidden bg-ink-950 px-4 pb-16 pt-32 sm:px-6 lg:px-8 lg:pb-20 lg:pt-40">
          <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
          <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
          <SectionTitle
            as="h1"
            tone="dark"
            eyebrow="Clientes"
            title="Empresas que já confiaram na PeriniHub"
            subtitle="Projetos entregues e funcionando em operações reais, todos os dias."
          />
        </section>

        <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="sr-only">Nossos clientes</h2>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            {clients.map((client) => (
              <ClientCard key={client.name} {...client} />
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-3xl bg-ink-900 p-8 text-white sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
            <div>
              <h2 className="font-display text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Quer ser o próximo?
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/70">
                Conte o que você precisa e receba um orçamento com escopo e prazo em até 24 horas.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
              <Button asChild size="lg" className="h-12 rounded-full bg-brand-600 px-6 text-white hover:bg-brand-700">
                <Link href="/#contato">
                  Solicitar orçamento
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Chamar no WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </main>
      <Footer />
    </>
  );
}
