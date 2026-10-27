import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Suspense } from "react";

import { ArticleCard } from "@/components/tech/article-card";
import { TechPageHeader } from "@/components/tech/page-header";
import { Pagination, parsePageParam } from "@/components/tech/pagination";
import { EmptyState, GridSkeleton } from "@/components/tech/states";
import { normalizeSearchQuery, searchArticles } from "@/lib/news/queries";
import { TECH_NAME, techAlternates } from "@/lib/news/seo";

// Resultados de busca não são indexados (conteúdo duplicado e infinito),
// mas os links seguem rastreáveis.
export const metadata: Metadata = {
  title: "Buscar notícias",
  description: `Pesquise as notícias publicadas no ${TECH_NAME}.`,
  alternates: techAlternates("/tech/busca"),
  robots: { index: false, follow: true },
};

async function SearchForm({ searchParams }: Pick<PageProps<"/tech/busca">, "searchParams">) {
  const q = normalizeSearchQuery((await searchParams).q);
  return <SearchFormView defaultValue={q} />;
}

function SearchFormView({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/tech/busca" method="get" role="search" className="mt-8 flex max-w-2xl gap-2">
      <label htmlFor="q" className="sr-only">
        Buscar notícias
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        minLength={2}
        maxLength={100}
        placeholder="Ex.: Next.js, PostgreSQL, vulnerabilidade"
        className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-5 text-base text-white outline-none placeholder:text-white/45 focus-visible:border-brand-400 focus-visible:ring-3 focus-visible:ring-brand-400/40"
      />
      <button
        type="submit"
        className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Buscar</span>
      </button>
    </form>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/tech/busca">, "searchParams">) {
  const params = await searchParams;
  const q = normalizeSearchQuery(params.q);
  const page = parsePageParam(params.pagina);

  if (q.length < 2) {
    return <EmptyState title="O que você procura?">Digite pelo menos duas letras para buscar nas notícias publicadas.</EmptyState>;
  }

  const result = await searchArticles(q, page);
  if (result.items.length === 0) {
    return (
      <EmptyState title="Nenhuma notícia encontrada" action={{ href: "/tech", label: "Ver as mais recentes" }}>
        Não achamos resultados para “{q}”. Tente outras palavras ou termos mais gerais.
      </EmptyState>
    );
  }

  const hrefFor = (n: number) => `/tech/busca?q=${encodeURIComponent(q)}${n > 1 ? `&pagina=${n}` : ""}`;
  return (
    <>
      <h2 className="mb-6 text-sm text-ink-900/65" aria-live="polite">
        {result.total} {result.total === 1 ? "resultado" : "resultados"} para “{q}”
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/tech/busca">) {
  return (
    <>
      <TechPageHeader eyebrow={TECH_NAME} title="Buscar notícias">
        <Suspense fallback={<SearchFormView />}>
          <SearchForm searchParams={searchParams} />
        </Suspense>
      </TechPageHeader>
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<GridSkeleton />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
