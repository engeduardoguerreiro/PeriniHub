import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AnimatedSection } from "@/components/perinihub/animated-section";
import { SectionTitle } from "@/components/perinihub/section-title";
import { getLatestArticles, type ArticleCard as ArticleCardData } from "@/lib/news/queries";

import { ArticleCard } from "./article-card";

/**
 * Seção da home com as notícias mais recentes. O site comercial vem primeiro:
 * sem artigos publicados ou com o banco fora do ar, a seção simplesmente não aparece.
 */
export async function LatestNewsSection() {
  let articles: ArticleCardData[] = [];
  try {
    articles = await getLatestArticles(3);
  } catch (error) {
    console.error("[home] notícias indisponíveis:", error instanceof Error ? error.message : error);
    return null;
  }
  if (articles.length === 0) return null;

  return (
    <AnimatedSection id="noticias" className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="PeriniHub Tech"
          title="Últimas notícias de tecnologia"
          subtitle="O que mudou nas ferramentas e plataformas que usamos todo dia, explicado em português e com fonte."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/tech"
            className="group inline-flex items-center gap-2 rounded-md text-sm font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="link-underline">Ver todas as notícias</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AnimatedSection>
  );
}
