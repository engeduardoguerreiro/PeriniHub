import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArticleBody } from "@/components/tech/article-body";
import { ArticleCard } from "@/components/tech/article-card";
import { NewsCover } from "@/components/tech/news-cover";
import { ShareLinks } from "@/components/tech/share-links";
import { GridSkeleton } from "@/components/tech/states";
import { TechCta } from "@/components/tech/tech-cta";
import { formatDate, formatDateTime } from "@/lib/news/format";
import { getArticleBySlug, getPublishedEntries, getRelatedArticles, type Article } from "@/lib/news/queries";
import { articleJsonLd, articleMetadata, articleUrl, TECH_NAME } from "@/lib/news/seo";
import { jsonLd } from "@/lib/site";

// Pré-renderiza os artigos mais recentes no build; os demais são gerados na
// primeira visita e ficam em cache (ISR). Com Cache Components a lista não pode
// ser vazia, então sem banco (CI) entra um placeholder que resolve em 404.
export async function generateStaticParams() {
  const entries = await getPublishedEntries(30);
  return entries.length > 0 ? entries.map((entry) => ({ slug: entry.slug })) : [{ slug: "__placeholder__" }];
}

async function loadArticle(slug: string): Promise<Article> {
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  return article;
}

export async function generateMetadata({ params }: PageProps<"/tech/[slug]">): Promise<Metadata> {
  const article = await getArticleBySlug((await params).slug);
  return article ? articleMetadata(article) : { title: "Notícia não encontrada", robots: { index: false } };
}

async function Related({ article }: { article: Article }) {
  const related = await getRelatedArticles(article.id, article.categoryId);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="relacionadas" className="mt-16">
      <h2 id="relacionadas" className="font-display text-2xl font-semibold tracking-tight text-ink-900">
        Leia também
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((item) => (
          <ArticleCard key={item.id} article={item} />
        ))}
      </div>
    </section>
  );
}

async function ArticleView({ params }: Pick<PageProps<"/tech/[slug]">, "params">) {
  const article = await loadArticle((await params).slug);
  const url = articleUrl(article.slug);
  const updated = article.updatedAt.slice(0, 16) !== article.publishedAt.slice(0, 16);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd(article)) }} />
      <article>
        <header className="relative isolate overflow-hidden bg-ink-950 px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:px-8">
          <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
          <div className="mx-auto max-w-3xl">
            <nav aria-label="Trilha de navegação">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
                <li>
                  <Link href="/tech" className="rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400">
                    {TECH_NAME}
                  </Link>
                </li>
                {article.category && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    <li>
                      <span className="text-aqua-300">{article.category.name}</span>
                    </li>
                  </>
                )}
              </ol>
            </nav>
            <h1 className="font-display mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem]">
              {article.title}
            </h1>
            {article.subtitle && <p className="mt-4 text-lg leading-8 text-white/75">{article.subtitle}</p>}
            <p className="mt-6 text-sm text-white/60">
              Publicado em <time dateTime={article.publishedAt}>{formatDateTime(article.publishedAt)}</time>
              {updated && (
                <>
                  {" · "}Atualizado em <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
                </>
              )}
            </p>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <figure className="-mt-px">
              <NewsCover
                categorySlug={article.category?.slug}
                imageUrl={article.coverImageUrl}
                imageAlt={article.coverImageAlt}
                size="lg"
                priority
                className="aspect-[16/9] rounded-b-2xl sm:aspect-[2/1]"
              />
              {article.coverImageCredit && (
                <figcaption className="mt-2 text-xs text-ink-900/50">Imagem: {article.coverImageCredit}</figcaption>
              )}
            </figure>

            <p className="mt-10 text-lg font-medium leading-8 text-ink-900">{article.excerpt}</p>
            <div className="mt-6">
              <ArticleBody markdown={article.content} />
            </div>

            {article.originalSources.length > 0 && (
              <section aria-labelledby="fontes" className="mt-12 rounded-2xl border border-ink-900/10 bg-white p-6">
                <h2 id="fontes" className="font-display text-lg font-semibold text-ink-900">
                  Fontes originais
                </h2>
                <ul className="mt-4 grid gap-3">
                  {article.originalSources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5 rounded-sm font-medium text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        <span>
                          {source.title}
                          {source.publisher && <span className="font-normal text-ink-900/55"> · {source.publisher}</span>}
                        </span>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <aside className="mt-6 flex gap-3 rounded-2xl bg-brand-50/70 p-5 text-sm leading-6 text-ink-900/75">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <p>
                Esta notícia foi redigida com apoio de inteligência artificial a partir das fontes acima,
                checada contra elas e revisada pela equipe editorial da PeriniHub antes da publicação.
                Encontrou um erro? Escreva para{" "}
                <a href="mailto:contato@perinihub.com.br" className="font-medium text-brand-700 underline underline-offset-4">
                  contato@perinihub.com.br
                </a>
                .
              </p>
            </aside>

            <div className="mt-8 border-t border-ink-900/10 pt-6">
              <ShareLinks url={url} title={article.title} />
            </div>
          </div>
        </div>
      </article>

      <div className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<GridSkeleton count={3} />}>
            <Related article={article} />
          </Suspense>
          <div className="mx-auto mt-16 max-w-3xl">
            <TechCta />
          </div>
        </div>
      </div>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando notícia">
      <div className="bg-ink-950 px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <div className="mx-auto grid max-w-3xl gap-4">
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-full animate-pulse rounded bg-white/10" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-10">
        <div className="aspect-[16/7] animate-pulse rounded-2xl bg-ink-900/8" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-ink-900/8" />
        ))}
      </div>
    </div>
  );
}

export default function ArticlePage({ params }: PageProps<"/tech/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleView params={params} />
    </Suspense>
  );
}
