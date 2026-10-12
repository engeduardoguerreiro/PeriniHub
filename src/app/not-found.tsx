import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        id="conteudo"
        className="relative isolate flex flex-1 items-center overflow-hidden bg-ink-950 px-4 pb-20 pt-36 text-white sm:px-6 lg:px-8"
      >
        <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
        <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-xl text-center">
          <p className="font-display text-gradient-brand text-7xl font-semibold">404</p>
          <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Página não encontrada
          </h1>
          <p className="mt-4 text-base leading-7 text-white/70">
            O endereço pode ter mudado ou não existe mais. Volte para o início ou fale com a gente.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-brand-600 px-6 text-white hover:bg-brand-700">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/#contato">Solicitar orçamento</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
