import type { Metadata } from "next";
import { Rss } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ArticleCard } from "@/components/tech/article-card";
import { CategoryNav } from "@/components/tech/category-nav";
import { TechPageHeader } from "@/components/tech/page-header";
import { Pagination, parsePageParam } from "@/components/tech/pagination";
import { EmptyState, GridSkeleton } from "@/components/tech/states";
import { TechCta } from "@/components/tech/tech-cta";
import { sharedOpenGraph } from "@/lib/metadata";
import { getArticlesPage, getCategories, getLatestArticles } from "@/lib/news/queries";
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

async function Featured() {
  const [featured] = await getLatestArticles(1);
  if (!featured) return null;
  return (
    <div className="mt-10">
      <h2 className="sr-only">Destaque</h2>
      <ArticleCard article={featured} variant="featured" tone="dark" priority />
    </div>
  );
}

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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => pagedPath("/tech", n)} />
    </>
  );
}

/** Três matérias por assunto, só das categorias que têm conteúdo. */
async function ByCategory() {
  const categories = await getCategories();
  const sections = await Promise.all(
    categories.map(async (category) => ({ category, page: await getArticlesPage(1, category.slug) })),
  );
  const filled = sections.filter((section) => section.page.items.length > 0);
  if (filled.length < 2) return null;

  return (
    <section aria-labelledby="por-assunto" className="mt-16">
      <h2 id="por-assunto" className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
        Por assunto
      </h2>
      <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {filled.map(({ category, page }) => (
          <div key={category.slug}>
            <div className="flex items-baseline justify-between gap-4 border-b border-ink-900/10 pb-3">
              <h3 className="font-display text-lg font-semibold text-ink-900">{category.name}</h3>
              <Link
                href={`/tech/categoria/${category.slug}`}
                className="rounded-sm text-sm font-medium text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Ver tudo<span className="sr-only"> de {category.name}</span>
              </Link>
            </div>
            <div className="mt-3 grid gap-2">
              {page.items.slice(0, 3).map((article) => (
                <ArticleCard key={article.id} article={article} variant="compact" headingLevel="h3" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Categories() {
  return <CategoryNav categories={await getCategories()} />;
}

export default function TechPage({ searchParams }: PageProps<"/tech">) {
  return (
    <>
      <TechPageHeader
        eyebrow={TECH_NAME}
        title="Notícias de tecnologia, com fonte"
        description="Lançamentos, atualizações e alertas de segurança, explicados em português e sempre com link para o anúncio original."
      >
        <Featured />
      </TechPageHeader>

      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Categories />
          <section aria-labelledby="mais-recentes" className="mt-8">
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
            <Suspense fallback={<GridSkeleton />}>
              <Latest searchParams={searchParams} />
            </Suspense>
          </section>
          <ByCategory />
          <div className="mt-16">
            <TechCta />
          </div>
        </div>
      </div>
    </>
  );
}
