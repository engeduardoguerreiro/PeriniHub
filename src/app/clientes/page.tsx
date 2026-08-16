import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { ClientCard } from "@/components/perinihub/cards";
import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { SectionTitle } from "@/components/perinihub/section-title";
import { WhatsAppFloatingButton } from "@/components/perinihub/whatsapp-floating-button";
import { Button } from "@/components/ui/button";
import { clients, WHATSAPP_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Clientes",
  description:
    "Empresas que confiaram na PeriniHub para desenvolver seus sites, sistemas e automações.",
  alternates: { canonical: "/clientes" },
};

export default function ClientesPage() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <section className="relative px-5 pb-10 pt-32 sm:px-6 lg:px-8 lg:pt-36">
          <div className="absolute inset-0 -z-10 grid-surface opacity-30" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-white/70" />
          <SectionTitle
            eyebrow="Clientes"
            title="Empresas que já confiaram na PeriniHub"
            subtitle="Projetos entregues e funcionando em operações reais, todos os dias."
          />
        </section>

        <AnimatedSection className="px-5 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            {clients.map((client) => (
              <ClientCard key={client.name} {...client} />
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection className="px-5 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-lg bg-zinc-950 p-7 text-white shadow-2xl shadow-zinc-950/12 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
                Quer ser o próximo?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-200">
                Conte o que você precisa e receba um orçamento com escopo e prazo em até 24 horas.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Button asChild size="lg" className="rounded-md bg-red-600 hover:bg-red-700">
                <Link href="/#contato">
                  Solicitar orçamento
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-md">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  Chamar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  );
}
