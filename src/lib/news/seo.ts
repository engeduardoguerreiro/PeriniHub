import type { Metadata } from "next";

import { sharedOpenGraph } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

import type { Article } from "./queries";

export const TECH_NAME = "PeriniHub Tech";
export const TECH_DESCRIPTION =
  "Notícias de tecnologia em português: lançamentos, atualizações e alertas de segurança, sempre com link para a fonte original.";

const RSS = { "application/rss+xml": [{ url: "/tech/rss.xml", title: TECH_NAME }] };

/**
 * O merge de metadata é raso: quem declara `alternates` substitui o objeto do
 * layout. Por isso canonical e o link do RSS saem juntos daqui.
 */
export function techAlternates(path: string): Metadata["alternates"] {
  return { canonical: path, types: RSS };
}

/** ?pagina=N > 1 entra no canonical; a página 1 aponta para a URL limpa. */
export function pagedPath(path: string, page: number) {
  return page > 1 ? `${path}?pagina=${page}` : path;
}

export function articleUrl(slug: string) {
  return `${SITE_URL}/tech/${slug}`;
}

export function articleMetadata(article: Article): Metadata {
  const title = article.seo.meta_title || article.title;
  const description = article.seo.meta_description || article.excerpt;
  const path = `/tech/${article.slug}`;
  return {
    title,
    description,
    keywords: article.seo.keywords ?? undefined,
    alternates: techAlternates(path),
    openGraph: {
      ...sharedOpenGraph,
      type: "article",
      url: path,
      title,
      description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      section: article.category?.name,
      tags: article.seo.keywords ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function articleJsonLd(article: Article) {
  const url = articleUrl(article.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: article.title.slice(0, 110),
        description: article.excerpt,
        image: [`${url}/opengraph-image`],
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: "pt-BR",
        articleSection: article.category?.name,
        keywords: article.seo.keywords?.join(", "),
        author: { "@type": "Organization", name: TECH_NAME, url: `${SITE_URL}/tech` },
        publisher: { "@id": `${SITE_URL}/#org` },
        isBasedOn: article.originalSources.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: TECH_NAME, item: `${SITE_URL}/tech` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };
}
