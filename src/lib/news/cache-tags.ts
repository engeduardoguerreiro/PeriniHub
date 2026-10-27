// Tags de cache do portal. O publicador e as ações do painel invalidam por
// estas tags; as leituras públicas (`use cache`) se registram nelas.
export const NEWS_TAGS = {
  /** Qualquer listagem de artigos publicados (home, /tech, categorias, RSS, sitemaps). */
  list: "news:list",
  categories: "news:categories",
  article: (slug: string) => `news:article:${slug}`,
} as const;
