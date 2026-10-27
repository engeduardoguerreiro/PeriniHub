import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArticleCard } from "@/components/tech/article-card";
import { CategoryNav } from "@/components/tech/category-nav";
import { TechPageHeader } from "@/components/tech/page-header";
import { Pagination, parsePageParam } from "@/components/tech/pagination";
import { EmptyState, GridSkeleton } from "@/components/tech/states";
import { TechCta } from "@/components/tech/tech-cta";
import { sharedOpenGraph } from "@/lib/metadata";
import { getArticlesPage, getCategories, getCategoryBySlug } from "@/lib/news/queries";
import { pagedPath, TECH_NAME, techAlternates } from "@/lib/news/seo";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.length > 0 ? categories.map(({ slug }) => ({ slug })) : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params, searchParams }: PageProps<"/tech/categoria/[slug]">): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) return { title: "Categoria não encontrada", robots: { index: false } };
  const page = parsePageParam((await searchParams).pagina);
  const path = pagedPath(`/tech/categoria/${category.slug}`, page);
  const title = `${category.name}: notícias`;
  const description = category.description ?? `Notícias de ${category.name} no ${TECH_NAME}.`;
  return {
    title: page > 1 ? `${title} (página ${page})` : title,
    description,
    alternates: techAlternates(path),
    openGraph: { ...sharedOpenGraph, url: path, title: `${title} | ${TECH_NAME}`, description },
  };
}

async function CategoryHeader({ params }: Pick<PageProps<"/tech/categoria/[slug]">, "params">) {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) notFound();
  return <TechPageHeader eyebrow={TECH_NAME} title={category.name} description={category.description} />;
}

async function CategoryArticles({ params, searchParams }: PageProps<"/tech/categoria/[slug]">) {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) notFound();
  const page = parsePageParam((await searchParams).pagina);
  const [result, categories] = await Promise.all([getArticlesPage(page, category.slug), getCategories()]);
  const basePath = `/tech/categoria/${category.slug}`;

  return (
    <>
      <CategoryNav categories={categories} active={category.slug} />
      <div className="mt-8">
        {result.items.length === 0 ? (
          <EmptyState title="Ainda não há notícias nesta categoria" action={{ href: "/tech", label: "Ver todas as notícias" }}>
            Assim que publicarmos algo sobre {category.name}, aparece aqui.
          </EmptyState>
        ) : (
          <>
            <h2 className="sr-only">Notícias de {category.name}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => pagedPath(basePath, n)} />
          </>
        )}
      </div>
    </>
  );
}

export default function CategoryPage(props: PageProps<"/tech/categoria/[slug]">) {
  return (
    <>
      <Suspense fallback={<TechPageHeader eyebrow={TECH_NAME} title="Carregando…" />}>
        <CategoryHeader params={props.params} />
      </Suspense>
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<GridSkeleton />}>
            <CategoryArticles {...props} />
          </Suspense>
          <div className="mt-16">
            <TechCta />
          </div>
        </div>
      </div>
    </>
  );
}
