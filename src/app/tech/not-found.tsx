import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// 404 do portal: o layout de /tech já traz header e rodapé.
export default function TechNotFound() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-950 px-4 pb-24 pt-36 text-white sm:px-6 lg:px-8">
      <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div className="mx-auto max-w-xl text-center">
        <p className="font-display text-gradient-brand text-7xl font-semibold">404</p>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Notícia não encontrada</h1>
        <p className="mt-4 text-base leading-7 text-white/70">
          O endereço pode estar incorreto ou a notícia não está mais disponível.
        </p>
        <Link
          href="/tech"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Ver todas as notícias
        </Link>
      </div>
    </div>
  );
}
