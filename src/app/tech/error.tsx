"use client";

import { RotateCcw } from "lucide-react";

// Falha de banco ou rede ao carregar o portal: mensagem amigável e nova tentativa.
// Detalhes do erro ficam no log do servidor, não na tela.
export default function TechError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="bg-ink-950 px-4 pb-24 pt-36 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Não conseguimos carregar as notícias
        </h1>
        <p className="mt-4 text-base leading-7 text-white/70">
          Pode ser uma instabilidade momentânea. Tente de novo em alguns instantes.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
