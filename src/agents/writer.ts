import { z } from "zod";

import { AgentError } from "@/lib/ai/errors";
import { runAgent } from "@/lib/ai/run-agent";
import { UNTRUSTED_RULES, wrapUntrusted } from "@/lib/ai/untrusted";
import { extractImageCandidates, storeCover } from "@/lib/news/images";
import { slugify, uniqueSlug } from "@/lib/news/slug";
import { htmlToText, normalizeText } from "@/lib/news/text";
import { safeFetch } from "@/lib/security/safe-fetch";
import type { Json } from "@/lib/supabase/database.types";

import { getSettings, type AgentContext, type Db } from "./types";

// Agente 3 — Writer. Escreve uma notícia original em português a partir das
// fontes coletadas. O modelo devolve só o texto de cada seção; estrutura,
// títulos das seções, referências e links são montados aqui.

const PAGE_TEXT_CHARS = 15_000;
const MIN_EVIDENCE_CHARS = 280;

// Schema tolerante de propósito: limites rígidos fariam a resposta inteira
// (já cobrada) ser rejeitada por um caractere a mais. Os tamanhos são
// normalizados depois, em normalizeWritten.
const articleSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  excerpt: z.string(),
  what_happened: z.string(),
  highlights: z.array(z.string()),
  technical_context: z.string(),
  impact: z.string(),
  /** Avisos do próprio redator: lacunas ou pontos sem confirmação nas fontes. */
  caveats: z.array(z.string()),
});
export type WrittenArticle = z.infer<typeof articleSchema>;

const WRITER_SYSTEM = `Você é redator do PeriniHub Tech e escreve notícias de tecnologia originais em português do Brasil, com tom jornalístico, claro e sem sensacionalismo.
Escreva somente com base nos documentos fornecidos:
- Não invente funcionalidades, versões, datas, números, preços, comparações ou benchmarks. Se algo não estiver nos documentos, não mencione.
- Não copie trechos longos: reescreva com suas palavras. Citações literais só se indispensáveis e com no máximo uma frase curta.
- Preserve exatamente nomes de produtos, versões, comandos, flags e trechos de código técnico (use crases para código).
- Atribua as afirmações à fonte ("segundo o anúncio", "de acordo com a equipe do projeto").
- Não inclua links nem referências no texto: as referências são adicionadas automaticamente.
- Campos: título informativo com no máximo 100 caracteres (sem caixa alta e sem exclamações), subtítulo de até 200 caracteres, resumo inicial (excerpt, 1 a 2 frases), o que aconteceu, principais novidades (itens curtos), contexto técnico (pode ficar vazio se as fontes não derem base), impacto para usuários ou desenvolvedores.
- Em "caveats", liste o que ficou sem confirmação ou ambíguo nas fontes.
- Use Markdown simples dentro dos campos de texto (parágrafos, **negrito** pontual, \`código\`); não use títulos (#).

${UNTRUSTED_RULES}`;

/** Fração de sequências de 8 palavras do texto que aparecem literalmente na fonte. */
export function verbatimOverlap(text: string, source: string, n = 8) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length < n) return 0;
  const sourceNorm = ` ${normalizeText(source)} `;
  let copied = 0;
  let total = 0;
  for (let i = 0; i + n <= words.length; i += 2) {
    total++;
    if (sourceNorm.includes(` ${words.slice(i, i + n).join(" ")} `)) copied++;
  }
  return total === 0 ? 0 : copied / total;
}

/** Remove links e HTML que o modelo eventualmente insira. */
function stripLinks(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/** Corta no limite sem quebrar palavra. */
export function clampText(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trim()}…`;
}

/** Ajusta tamanhos e recusa só o que torna o artigo inviável. */
export function normalizeWritten(article: WrittenArticle): WrittenArticle {
  const normalized: WrittenArticle = {
    title: clampText(article.title.replace(/[!]+/g, ""), 110),
    subtitle: clampText(article.subtitle, 220),
    excerpt: clampText(article.excerpt, 300),
    what_happened: article.what_happened.trim().slice(0, 4000),
    highlights: article.highlights.map((item) => clampText(item, 400)).filter((item) => item.length >= 5).slice(0, 8),
    technical_context: article.technical_context.trim().slice(0, 4000),
    impact: article.impact.trim().slice(0, 3000),
    caveats: article.caveats.map((item) => clampText(item, 300)).slice(0, 5),
  };
  if (normalized.title.length < 10 || normalized.excerpt.length < 20 || normalized.what_happened.length < 80 || normalized.highlights.length === 0) {
    throw new AgentError("Texto gerado incompleto (título, resumo ou seções vazios)", "incomplete_output", false);
  }
  return normalized;
}

export type SourceRef = { title: string; url: string; publisher: string; published_at: string | null };

/** Corpo do artigo. As fontes aparecem na página em "Fontes originais", fora do Markdown. */
export function buildMarkdown(article: WrittenArticle) {
  const parts = [
    "## O que aconteceu",
    stripLinks(article.what_happened),
    "## Principais novidades",
    article.highlights.map((item) => `- ${stripLinks(item).replace(/\n+/g, " ")}`).join("\n"),
  ];
  const context = stripLinks(article.technical_context);
  if (context) parts.push("## Contexto técnico", context);
  parts.push("## Impacto", stripLinks(article.impact));
  return parts.join("\n\n");
}

async function takenSlugs(db: Db, base: string) {
  const { data } = await db.from("news_articles").select("slug").like("slug", `${base}%`);
  return new Set((data ?? []).map((row) => row.slug));
}

export type WriteResult = { articleId: string; created: boolean } | { articleId: null; skipped: string };

export async function writeArticle(ctx: AgentContext, candidateId: string): Promise<WriteResult> {
  const { db } = ctx;

  // Idempotência: um candidato gera no máximo um artigo (constraint única no banco).
  const { data: existing } = await db.from("news_articles").select("id").eq("candidate_id", candidateId).maybeSingle();
  if (existing) return { articleId: existing.id, created: false };

  // Lease: se outra execução já está escrevendo este candidato, não duplica o gasto.
  const { data: claimed, error: claimError } = await db.rpc("news_claim_candidate", {
    p_candidate_id: candidateId,
    p_lease_seconds: 900,
  });
  if (claimError) throw new AgentError(claimError.message, "db", true);
  if (!claimed) return { articleId: null, skipped: "em processamento por outra execução" };

  const { data: candidate, error } = await db
    .from("news_candidates")
    .select("*, source:news_sources(name, website_url, trust_level)")
    .eq("id", candidateId)
    .single();
  if (error) throw new AgentError(`Candidato não encontrado: ${error.message}`, "not_found", false);
  if (candidate.processing_status !== "eligible") {
    return { articleId: null, skipped: `status ${candidate.processing_status}` };
  }

  const metadata = (candidate.metadata ?? {}) as Record<string, Json>;

  // Texto da página original (fonte primária). Falha aqui não é fatal: sobra o resumo do feed.
  let pageText = typeof metadata.page_text === "string" ? metadata.page_text : "";
  let imageCandidates = Array.isArray(metadata.page_images) ? metadata.page_images.filter((url): url is string => typeof url === "string") : [];
  if (!pageText) {
    try {
      const page = await safeFetch(candidate.original_url, { accept: ["text/html", "application/xhtml"], maxBytes: 3_000_000 });
      pageText = htmlToText(page.body, PAGE_TEXT_CHARS);
      imageCandidates = extractImageCandidates(page.body, page.url);
    } catch (fetchError) {
      ctx.log?.("página original indisponível", { url: candidate.original_url, error: String(fetchError) });
    }
  }

  // Outras fontes sobre o mesmo acontecimento (duplicados) = evidência independente.
  const { data: related } = await db
    .from("news_candidates")
    .select("id, original_title, original_url, summary, source_published_at, source:news_sources(name)")
    .eq("duplicate_of", candidateId)
    .limit(4);

  const primaryText = [candidate.summary ?? "", pageText].filter(Boolean).join("\n\n");
  if (primaryText.length < MIN_EVIDENCE_CHARS) {
    await db
      .from("news_candidates")
      .update({
        processing_status: "failed",
        last_error: "Conteúdo insuficiente nas fontes para escrever sem inventar",
        locked_until: null,
      })
      .eq("id", candidateId);
    return { articleId: null, skipped: "conteúdo insuficiente" };
  }

  const documents = [
    { id: "fonte-principal", source: `${candidate.source?.name ?? "?"} — ${candidate.original_url}`, content: `Título: ${candidate.original_title}\n\n${primaryText}` },
    ...(related ?? []).map((item, index) => ({
      id: `fonte-${index + 2}`,
      source: `${item.source?.name ?? "?"} — ${item.original_url}`,
      content: `Título: ${item.original_title}\n\n${item.summary ?? ""}`,
    })),
  ];

  // Falha daqui em diante libera o lease, senão o retry da tarefa encontraria
  // o candidato "em processamento" e não faria nada.
  const release = () => db.from("news_candidates").update({ locked_until: null }).eq("id", candidateId);
  let raw: WrittenArticle;
  try {
    ({ data: raw } = await runAgent({
      db,
      agent: "writer",
      system: WRITER_SYSTEM,
      prompt: `Escreva a notícia sobre o acontecimento descrito na fonte principal.\n\n${wrapUntrusted(documents, PAGE_TEXT_CHARS)}`,
      schema: articleSchema,
      effort: "medium",
      input: { candidate_id: candidateId },
      idempotencyKey: `writer:${candidateId}:${candidate.attempts}`,
      runId: ctx.runId,
    }));
  } catch (error) {
    await release();
    throw error;
  }

  const sources: SourceRef[] = [
    { title: candidate.original_title, url: candidate.original_url, publisher: candidate.source?.name ?? new URL(candidate.original_url).hostname, published_at: candidate.source_published_at },
    ...(related ?? []).map((item) => ({ title: item.original_title, url: item.original_url, publisher: item.source?.name ?? new URL(item.original_url).hostname, published_at: item.source_published_at })),
  ];
  const written = normalizeWritten(raw);
  const content = buildMarkdown(written);
  const overlap = verbatimOverlap(content, primaryText);

  const { data: category } = typeof metadata.category_slug === "string"
    ? await db.from("news_categories").select("id").eq("slug", metadata.category_slug).maybeSingle()
    : { data: null };

  const baseSlug = slugify(written.title) || `noticia-${candidateId.slice(0, 8)}`;
  const slug = uniqueSlug(baseSlug, await takenSlugs(db, baseSlug));
  const risk = overlap > 0.15 ? "high" : ((metadata.risk as "low" | "medium" | "high" | undefined) ?? "medium");

  const { data: inserted, error: insertError } = await db
    .from("news_articles")
    .upsert(
      {
        candidate_id: candidateId,
        slug,
        title: written.title.trim(),
        subtitle: written.subtitle.trim() || null,
        excerpt: written.excerpt.trim(),
        content,
        category_id: category?.id ?? null,
        status: "draft",
        verification_status: "pending",
        risk_level: risk,
        original_sources: sources,
        review_notes:
          [
            ...written.caveats.map((caveat) => `Redator: ${caveat}`),
            overlap > 0.15 ? `Atenção: ${Math.round(overlap * 100)}% de trechos literais da fonte (verificar cópia).` : null,
          ]
            .filter(Boolean)
            .join("\n") || null,
      },
      { onConflict: "candidate_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw new AgentError(`Falha ao salvar artigo: ${insertError.message}`, "db", true);

  await db
    .from("news_candidates")
    .update({
      processing_status: "drafted",
      locked_until: null,
      metadata: { ...metadata, page_text: pageText.slice(0, PAGE_TEXT_CHARS), page_images: imageCandidates, verbatim_overlap: overlap },
    })
    .eq("id", candidateId);

  if (inserted.length === 0) {
    // Corrida perdida para outra execução: devolve o artigo que ficou.
    const { data: winner, error: winnerError } = await db.from("news_articles").select("id").eq("candidate_id", candidateId).single();
    if (winnerError) throw new AgentError(`Artigo do candidato não encontrado: ${winnerError.message}`, "db", true);
    return { articleId: winner.id, created: false };
  }
  const articleId = inserted[0].id;
  const feedImage = typeof metadata.feed_image === "string" ? metadata.feed_image : null;
  await attachSourceCover(ctx, articleId, [...imageCandidates, ...(feedImage ? [feedImage] : [])], sources[0].publisher);
  return { articleId, created: true };
}

/**
 * Capa a partir da imagem de divulgação da fonte, se a política permitir.
 * Falha aqui nunca derruba a redação: o portal usa a capa gerada.
 */
export async function attachSourceCover(ctx: AgentContext, articleId: string, candidates: string[], publisher: string) {
  if (candidates.length === 0) return null;
  try {
    const settings = await getSettings(ctx.db);
    if (!settings.source_images_enabled) return null;
    const cover = await storeCover(ctx.db, articleId, candidates, ctx.log);
    if (!cover) return null;
    await ctx.db
      .from("news_articles")
      .update({ cover_image_url: cover.url, cover_image_credit: `Divulgação: ${publisher}`.slice(0, 200) })
      .eq("id", articleId);
    return cover;
  } catch (error) {
    ctx.log?.("capa não anexada", { articleId, erro: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * (Re)busca a capa de um artigo já existente a partir da fonte: usa as
 * imagens guardadas na redação ou relê a página original.
 */
export async function refreshArticleCover(ctx: AgentContext, articleId: string) {
  const { db } = ctx;
  const { data: article, error } = await db
    .from("news_articles")
    .select("id, slug, status, candidate_id, original_sources")
    .eq("id", articleId)
    .single();
  if (error) throw new AgentError(`Artigo não encontrado: ${error.message}`, "not_found", false);

  const sources = Array.isArray(article.original_sources) ? (article.original_sources as SourceRef[]) : [];
  let candidates: string[] = [];
  if (article.candidate_id) {
    const { data: candidate } = await db.from("news_candidates").select("metadata").eq("id", article.candidate_id).single();
    const metadata = (candidate?.metadata ?? {}) as Record<string, Json>;
    if (Array.isArray(metadata.page_images)) candidates.push(...metadata.page_images.filter((url): url is string => typeof url === "string"));
    if (typeof metadata.feed_image === "string") candidates.push(metadata.feed_image);
  }
  if (candidates.length === 0 && sources[0]?.url) {
    const page = await safeFetch(sources[0].url, { accept: ["text/html", "application/xhtml"], maxBytes: 3_000_000 });
    candidates = extractImageCandidates(page.body, page.url);
  }
  const cover = await attachSourceCover(ctx, articleId, candidates, sources[0]?.publisher ?? "fonte original");
  return { articleId, slug: article.slug, published: article.status === "published", cover };
}
