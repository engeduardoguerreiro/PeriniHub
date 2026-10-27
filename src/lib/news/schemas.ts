import { z } from "zod";

// Contratos dos campos JSON de news_articles. O banco guarda jsonb livre;
// tudo que sai dele para a tela passa por aqui.

export const originalSourceSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https?$/ }),
  publisher: z.string().trim().max(120).nullish(),
  published_at: z.iso.datetime({ offset: true }).nullish(),
});
export type OriginalSource = z.infer<typeof originalSourceSchema>;

export const originalSourcesSchema = z.array(originalSourceSchema).max(10);

export const internalLinkSchema = z.object({
  href: z.string().regex(/^\/[a-z0-9/#?=&-]*$/i),
  label: z.string().trim().min(1).max(120),
});

export const seoMetadataSchema = z.object({
  meta_title: z.string().trim().max(70).nullish(),
  meta_description: z.string().trim().max(170).nullish(),
  keywords: z.array(z.string().trim().min(1).max(40)).max(12).nullish(),
  internal_links: z.array(internalLinkSchema).max(6).nullish(),
});
export type SeoMetadata = z.infer<typeof seoMetadataSchema>;

/** Lê as fontes de um artigo descartando entradas inválidas em vez de quebrar a página. */
export function parseOriginalSources(value: unknown): OriginalSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = originalSourceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseSeoMetadata(value: unknown): SeoMetadata {
  const parsed = seoMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/**
 * Capas aceitas pelo portal: arquivos locais (/...) ou o bucket público do
 * Storage do próprio projeto Supabase. Outras origens exigiriam liberar o
 * host no next/image e conferir licença, então caem na capa gerada.
 */
export function isAllowedCoverUrl(url: string | null | undefined, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!url) return false;
  if (/^\/(?!\/)[\w\-./]+$/.test(url)) return true;
  return Boolean(supabaseUrl) && url.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
}
