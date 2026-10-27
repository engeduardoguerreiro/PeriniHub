import { z } from "zod";

import { AgentError } from "@/lib/ai/errors";
import { runAgent } from "@/lib/ai/run-agent";
import { UNTRUSTED_RULES } from "@/lib/ai/untrusted";
import { isValidSlug, slugify, uniqueSlug } from "@/lib/news/slug";

import { clampText } from "./writer";
import { getSettings, type AgentContext } from "./types";

// Agente 5 — SEO Editor. Prepara metadados editoriais sem mudar o conteúdo
// verificado. Capa: o portal gera capas próprias por categoria (sem custo e
// sem risco de direitos autorais), então aqui só sai o texto alternativo.

const seoSchema = z.object({
  meta_title: z.string(),
  meta_description: z.string(),
  slug: z.string(),
  keywords: z.array(z.string()),
  internal_links: z.array(z.object({ href: z.string(), label: z.string() })),
  cover_image_alt: z.string(),
});

const SEO_SYSTEM = `Você é editor de SEO do PeriniHub Tech. Prepare metadados para a notícia, sem alterar fatos:
- meta_title: até 60 caracteres, informativo, sem sensacionalismo, sem caixa alta, sem exclamações, sem o nome do portal.
- meta_description: 120 a 155 caracteres, resumindo o fato principal.
- slug: em português, minúsculas, palavras separadas por hífen, sem acentos, até 70 caracteres, com o nome do produto/versão.
- keywords: 3 a 8 termos que um leitor buscaria (produto, versão, tema).
- internal_links: até 3 links relevantes escolhidos SOMENTE da lista de páginas internas fornecida (use o href exatamente como está).
- cover_image_alt: descrição curta (até 120 caracteres) de uma capa ilustrativa com o tema da notícia.
Não escreva conteúdo feito só para enganar buscadores (repetição de palavras-chave, promessas exageradas).

${UNTRUSTED_RULES}`;

const CLICKBAIT = /\b(chocante|inacredit[aá]vel|voc[eê] n[aã]o vai acreditar|urgente|bomba|imperd[ií]vel)\b|!{1,}|\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{6,}\b/u;

/** Recusa títulos sensacionalistas e cai para o título editorial do artigo. */
export function safeMetaTitle(candidate: string, fallback: string) {
  const title = clampText(candidate, 60);
  return title.length >= 15 && !CLICKBAIT.test(title) ? title : clampText(fallback, 60);
}

export type SeoResult = { articleId: string; slug: string; status: string };

export async function prepareSeo(ctx: AgentContext, articleId: string): Promise<SeoResult> {
  const { db } = ctx;
  const { data: article, error } = await db
    .from("news_articles")
    .select("id, slug, title, excerpt, content, status, verification_status, risk_level, category:news_categories(name, slug)")
    .eq("id", articleId)
    .single();
  if (error) throw new AgentError(`Artigo não encontrado: ${error.message}`, "not_found", false);
  if (!["draft", "needs_review", "blocked"].includes(article.status)) {
    return { articleId, slug: article.slug, status: article.status };
  }

  const [{ data: categories }, { data: recent }] = await Promise.all([
    db.from("news_categories").select("name, slug").eq("enabled", true),
    db.from("news_articles").select("title, slug").eq("status", "published").order("published_at", { ascending: false }).limit(12),
  ]);
  const internalTargets = [
    { href: "/tech", label: "PeriniHub Tech" },
    ...(categories ?? []).map((category) => ({ href: `/tech/categoria/${category.slug}`, label: category.name })),
    ...(recent ?? []).map((item) => ({ href: `/tech/${item.slug}`, label: item.title })),
  ];
  const allowedHrefs = new Set(internalTargets.map((target) => target.href));

  const { data } = await runAgent({
    db,
    agent: "seo_editor",
    system: SEO_SYSTEM,
    prompt: [
      `Título: ${article.title}`,
      `Categoria: ${article.category?.name ?? "sem categoria"}`,
      `Resumo: ${article.excerpt}`,
      `Texto (início):\n${article.content.slice(0, 4000)}`,
      "",
      "Páginas internas disponíveis:",
      internalTargets.map((target) => `- ${target.href} — ${target.label}`).join("\n"),
    ].join("\n"),
    schema: seoSchema,
    effort: "low",
    input: { article_id: articleId },
    idempotencyKey: `seo_editor:${articleId}:${article.content.length}`,
    runId: ctx.runId,
  });

  const proposed = slugify(data.slug, 70);
  const base = isValidSlug(proposed) && proposed.length >= 8 ? proposed : article.slug;
  const { data: taken } = await db.from("news_articles").select("slug").like("slug", `${base}%`).neq("id", articleId);
  const slug = uniqueSlug(base, new Set((taken ?? []).map((row) => row.slug)), 80);

  const seoMetadata = {
    meta_title: safeMetaTitle(data.meta_title, article.title),
    meta_description: clampText(data.meta_description, 160),
    keywords: data.keywords.map((keyword) => clampText(keyword, 40)).filter(Boolean).slice(0, 8),
    internal_links: data.internal_links.filter((link) => allowedHrefs.has(link.href)).slice(0, 3).map((link) => ({ href: link.href, label: clampText(link.label, 120) })),
  };

  // Aprovação automática só existe se a política permitir e o artigo estiver
  // verificado e sem risco alto; caso contrário, vai para revisão humana.
  const settings = await getSettings(db);
  const autoApprove =
    !settings.approval_required &&
    article.verification_status === "verified" &&
    article.risk_level !== "high" &&
    article.status !== "blocked";
  const status = article.status === "blocked" ? "blocked" : autoApprove ? "approved" : "needs_review";

  const { error: updateError } = await db
    .from("news_articles")
    .update({ slug, seo_metadata: seoMetadata, cover_image_alt: clampText(data.cover_image_alt, 150), status })
    .eq("id", articleId)
    .in("status", ["draft", "needs_review", "blocked"]);
  if (updateError) throw new AgentError(`Falha ao salvar SEO: ${updateError.message}`, "db", true);

  return { articleId, slug, status };
}
