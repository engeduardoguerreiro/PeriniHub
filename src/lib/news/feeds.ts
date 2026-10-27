import { SITE_URL } from "@/lib/site";

import type { ArticleCard, PublishedEntry } from "./queries";
import { TECH_DESCRIPTION, TECH_NAME } from "./seo";

/** Escapa texto para XML (conteúdo e atributos). */
export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Caracteres de controle são inválidos em XML 1.0.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

export function buildRssFeed(articles: ArticleCard[]) {
  const items = articles
    .map((article) => {
      const url = `${SITE_URL}/tech/${article.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
        article.category ? `      <category>${escapeXml(article.category.name)}</category>` : null,
        `      <description>${escapeXml(article.excerpt)}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const lastBuild = articles[0] ? new Date(articles[0].publishedAt).toUTCString() : null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TECH_NAME)}</title>
    <link>${SITE_URL}/tech</link>
    <description>${escapeXml(TECH_DESCRIPTION)}</description>
    <language>pt-BR</language>
    <atom:link href="${SITE_URL}/tech/rss.xml" rel="self" type="application/rss+xml"/>
${lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
}

const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Sitemap no formato Google News: só artigos dos últimos 2 dias (regra do
 * Google News), no máximo 1000.
 */
export function buildNewsSitemap(entries: PublishedEntry[], now: number) {
  const recent = entries.filter((entry) => now - new Date(entry.publishedAt).getTime() <= NEWS_WINDOW_MS).slice(0, 1000);
  const urls = recent
    .map(
      (entry) => `  <url>
    <loc>${SITE_URL}/tech/${entry.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(TECH_NAME)}</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${new Date(entry.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(entry.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
}
