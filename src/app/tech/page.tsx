import type { Metadata } from "next";
import { Rss } from "lucide-react";
import { Suspense } from "react";

import { ArticleCard } from "@/components/tech/article-card";
import { TechPageHeader } from "@/components/tech/page-header";
import { Pagination, parsePageParam } from "@/components/tech/pagination";
import { EmptyState, GridSkeleton } from "@/components/tech/states";
import { TechCta } from "@/components/tech/tech-cta";
import { sharedOpenGraph } from "@/lib/metadata";
import { getArticlesPage, PORTAL_PAGE_SIZE } from "@/lib/news/queries";
import { pagedPath, TECH_DESCRIPTION, TECH_NAME, techAlternates } from "@/lib/news/seo";

const TITLE = `${TECH_NAME}: notícias de tecnologia`;

export async function generateMetadata({ searchParams }: PageProps<"/tech">): Promise<Metadata> {
  const page = parsePageParam((await searchParams).pagina);
  const path = pagedPath("/tech", page);
  return {
    title: page > 1 ? `${TITLE} (página ${page})` : TITLE,
    description: TECH_DESCRIPTION,
    alternates: techAlternates(path),
    openGraph: { ...sharedOpenGraph, url: path, title: TITLE, description: TECH_DESCRIPTION },
  };
}

/** As 4 matérias mais recentes; as anteriores ficam nas páginas seguintes. */
async function Latest({ searchParams }: Pick<PageProps<"/tech">, "searchParams">) {
  const page = parsePageParam((await searchParams).pagina);
  const result = await getArticlesPage(page);

  if (result.items.length === 0) {
    return page > 1 ? (
      <EmptyState title="Página não encontrada" action={{ href: "/tech", label: "Voltar ao início do portal" }}>
        Não há notícias nesta página.
      </EmptyState>
    ) : (
      <EmptyState title="As primeiras notícias estão a caminho">
        Nossa equipe está selecionando e revisando as novidades. Volte em breve.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {result.items.map((article, index) => (
          <ArticleCard key={article.id} article={article} priority={result.page === 1 && index === 0} />
        ))}
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => pagedPath("/tech", n)} />
    </>
  );
}

export default function TechPage({ searchParams }: PageProps<"/tech">) {
  return (
    <>
      <TechPageHeader
        eyebrow={TECH_NAME}
        title="Notícias de tecnologia, com fonte"
        description="Lançamentos, atualizações e alertas de segurança, explicados em português e sempre com link para o anúncio original."
      />

      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section aria-labelledby="mais-recentes">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 id="mais-recentes" className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                Mais recentes
              </h2>
              <a
                href="/tech/rss.xml"
                className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-900/60 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <Rss className="h-4 w-4" aria-hidden="true" />
                RSS
              </a>
            </div>
            <Suspense fallback={<GridSkeleton count={PORTAL_PAGE_SIZE} className="lg:grid-cols-2 xl:grid-cols-4" />}>
              <Latest searchParams={searchParams} />
            </Suspense>
          </section>
          <div className="mt-16">
            <TechCta />
          </div>
        </div>
      </div>
    </>
  );
}
