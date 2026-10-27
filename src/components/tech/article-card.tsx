import Link from "next/link";

import type { ArticleCard as ArticleCardData } from "@/lib/news/queries";
import { formatDate } from "@/lib/news/format";
import { cn } from "@/lib/utils";

import { NewsCover } from "./news-cover";

type ArticleCardProps = {
  article: ArticleCardData;
  variant?: "default" | "featured" | "compact";
  tone?: "light" | "dark";
  headingLevel?: "h2" | "h3";
  priority?: boolean;
};

/** Card de matéria: o link cobre o card inteiro, mas só o título é lido como link. */
export function ArticleCard({
  article,
  variant = "default",
  tone = "light",
  headingLevel: Heading = "h3",
  priority,
}: ArticleCardProps) {
  const dark = tone === "dark";
  const featured = variant === "featured";
  const compact = variant === "compact";

  return (
    <article
      className={cn(
        "group relative flex h-full overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-300 focus-within:ring-2 focus-within:ring-brand-500 motion-reduce:transition-none",
        featured ? "flex-col lg:grid lg:grid-cols-[1.25fr_1fr]" : compact ? "flex-row items-center gap-4 p-3" : "flex-col",
        dark
          ? "border-white/10 bg-white/[0.04] hover:border-white/20"
          : "border-ink-900/8 bg-white hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_40px_-18px_rgb(8_24_56/0.25)] motion-reduce:hover:translate-y-0",
      )}
    >
      <NewsCover
        categorySlug={article.category?.slug}
        imageUrl={article.coverImageUrl}
        imageAlt={article.coverImageAlt}
        size={featured ? "lg" : "sm"}
        priority={priority}
        className={cn(
          featured ? "aspect-[16/9] lg:aspect-auto lg:min-h-80" : compact ? "aspect-square w-20 shrink-0 rounded-xl" : "aspect-[16/9]",
        )}
      />
      <div className={cn("flex flex-1 flex-col", featured ? "p-6 sm:p-8 lg:justify-center" : compact ? "py-1 pr-2" : "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {article.category && (
            <span className={cn("font-semibold uppercase tracking-[0.14em]", dark ? "text-aqua-300" : "text-brand-700")}>
              {article.category.name}
            </span>
          )}
          <time dateTime={article.publishedAt} className={dark ? "text-white/55" : "text-ink-900/55"}>
            {formatDate(article.publishedAt)}
          </time>
        </div>
        <Heading
          className={cn(
            "font-display mt-2 text-balance font-semibold tracking-tight",
            featured ? "text-2xl sm:text-3xl lg:text-[2.1rem] lg:leading-tight" : compact ? "text-base leading-snug" : "text-lg sm:text-xl",
            dark ? "text-white" : "text-ink-900",
          )}
        >
          <Link
            href={`/tech/${article.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </Heading>
        {!compact && (
          <p
            className={cn(
              "mt-3 line-clamp-3 text-sm leading-6 sm:text-[15px] sm:leading-7",
              dark ? "text-white/70" : "text-ink-900/65",
              featured && "sm:text-base sm:leading-7",
            )}
          >
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
