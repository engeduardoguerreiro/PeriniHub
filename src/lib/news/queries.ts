import { cacheLife, cacheTag } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

import { NEWS_TAGS } from "./cache-tags";
import { parseOriginalSources, parseSeoMetadata, type OriginalSource, type SeoMetadata } from "./schemas";
import { isValidSlug } from "./slug";

// Leituras públicas do portal. Todas usam o cliente anônimo: o RLS só devolve
// artigos com status "published" e published_at no passado, então rascunhos
// nunca entram no cache, mesmo que uma consulta aqui esqueça um filtro.
//
// Sem Supabase configurado (CI, build local sem .env) as listas voltam vazias.
// Erro de banco lança exceção: um artigo publicado não pode virar 404 cacheado.

export const PAGE_SIZE = 12;
/** A capa do portal mostra as 4 mais recentes e navega de 4 em 4. */
export const PORTAL_PAGE_SIZE = 4;

export type CategoryRef = { name: string; slug: string };

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string;
  category: CategoryRef | null;
};

export type Article = ArticleCard & {
  subtitle: string | null;
  content: string;
  coverImageCredit: string | null;
  categoryId: string | null;
  updatedAt: string;
  originalSources: OriginalSource[];
  seo: SeoMetadata;
};

export type ArticlePage = { items: ArticleCard[]; total: number; page: number; pageCount: number };

export type Category = CategoryRef & { id: string; description: string | null };

const CARD_FIELDS =
  "id, slug, title, excerpt, cover_image_url, cover_image_alt, published_at, category:news_categories(name, slug)";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  published_at: string | null;
  category: CategoryRef | null;
};

export class NewsQueryError extends Error {
  constructor(operation: string, message: string) {
    super(`Falha ao consultar notícias (${operation}): ${message}`);
    this.name = "NewsQueryError";
  }
}

function toCard(row: CardRow): ArticleCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    // published_at é garantido pela constraint de status "published".
    publishedAt: row.published_at ?? "",
    category: row.category,
  };
}

function clampPage(page: number) {
  return Number.isInteger(page) && page > 0 && page <= 1000 ? page : 1;
}

export async function getLatestArticles(limit = 6): Promise<ArticleCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);

  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("news_articles")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new NewsQueryError("latest", error.message);
  return data.map(toCard);
}

export async function getArticlesPage(page: number): Promise<ArticlePage> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);

  const current = clampPage(page);
  const db = createPublicClient();
  if (!db) return { items: [], total: 0, page: current, pageCount: 0 };

  const from = (current - 1) * PORTAL_PAGE_SIZE;
  // Data e hora de publicação, da mais nova para a mais antiga; o id desempata
  // para que nenhuma matéria se repita ou suma entre uma página e outra.
  const { data, error, count } = await db
    .from("news_articles")
    .select(CARD_FIELDS, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PORTAL_PAGE_SIZE - 1);
  if (error) throw new NewsQueryError("page", error.message);

  const total = count ?? 0;
  return {
    items: data.map(toCard),
    total,
    page: current,
    pageCount: Math.ceil(total / PORTAL_PAGE_SIZE),
  };
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  "use cache";
  cacheLife("days");
  cacheTag(NEWS_TAGS.article(slug), NEWS_TAGS.list);

  if (!isValidSlug(slug)) return null;
  const db = createPublicClient();
  if (!db) return null;

  const { data, error } = await db
    .from("news_articles")
    .select(
      `${CARD_FIELDS}, subtitle, content, cover_image_credit, category_id, updated_at, original_sources, seo_metadata`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new NewsQueryError("article", error.message);
  if (!data) return null;

  return {
    ...toCard(data),
    subtitle: data.subtitle,
    content: data.content,
    coverImageCredit: data.cover_image_credit,
    categoryId: data.category_id,
    updatedAt: data.updated_at,
    originalSources: parseOriginalSources(data.original_sources),
    seo: parseSeoMetadata(data.seo_metadata),
  };
}

/** Até `limit` artigos da mesma categoria; completa com os mais recentes. */
export async function getRelatedArticles(
  articleId: string,
  categoryId: string | null,
  limit = 3,
): Promise<ArticleCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);

  const db = createPublicClient();
  if (!db) return [];

  const related: ArticleCard[] = [];
  if (categoryId) {
    const { data, error } = await db
      .from("news_articles")
      .select(CARD_FIELDS)
      .eq("status", "published")
      .eq("category_id", categoryId)
      .neq("id", articleId)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw new NewsQueryError("related", error.message);
    related.push(...data.map(toCard));
  }
  if (related.length < limit) {
    const exclude = [articleId, ...related.map((item) => item.id)];
    const { data, error } = await db
      .from("news_articles")
      .select(CARD_FIELDS)
      .eq("status", "published")
      .not("id", "in", `(${exclude.join(",")})`)
      .order("published_at", { ascending: false })
      .limit(limit - related.length);
    if (error) throw new NewsQueryError("related-fill", error.message);
    related.push(...data.map(toCard));
  }
  return related;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("days");
  cacheTag(NEWS_TAGS.categories);

  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("news_categories")
    .select("id, name, slug, description")
    .eq("enabled", true)
    .order("sort_order");
  if (error) throw new NewsQueryError("categories", error.message);
  return data;
}

/** Normaliza a busca do usuário: texto curto, sem caracteres de controle. */
export function normalizeSearchQuery(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export async function searchArticles(query: string, page: number): Promise<ArticlePage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEWS_TAGS.list);

  const current = clampPage(page);
  const q = normalizeSearchQuery(query);
  const db = createPublicClient();
  if (!db || q.length < 2) return { items: [], total: 0, page: current, pageCount: 0 };

  const from = (current - 1) * PAGE_SIZE;
  const { data, error, count } = await db
    .from("news_articles")
    .select(CARD_FIELDS, { count: "exact" })
    .eq("status", "published")
    .textSearch("search_vector", q, { type: "websearch", config: "portuguese" })
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new NewsQueryError("search", error.message);

  const total = count ?? 0;
  return { items: data.map(toCard), total, page: current, pageCount: Math.ceil(total / PAGE_SIZE) };
}

export type PublishedEntry = { slug: string; title: string; publishedAt: string; updatedAt: string };

/** Artigos para sitemaps, RSS e generateStaticParams. */
export async function getPublishedEntries(limit = 1000): Promise<PublishedEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);

  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("news_articles")
    .select("slug, title, published_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new NewsQueryError("entries", error.message);
  return data.map((row) => ({
    slug: row.slug,
    title: row.title,
    publishedAt: row.published_at ?? row.updated_at,
    updatedAt: row.updated_at,
  }));
}
