import { FeedParseError, parseFeed, type FeedItem } from "@/lib/news/feed-parser";
import { canonicalizeUrl, titleFingerprint, titleTokens } from "@/lib/news/text";
import { safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";

import { getSettings, type AgentContext } from "./types";

// Agente 1 — Researcher. Determinístico de propósito: lê só feeds RSS/Atom
// oficiais cadastrados (sem scraping), registra origem, URL, datas e o resumo
// disponível. Não usa IA, então não consome orçamento.

const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const UNDATED_TOP_ITEMS = 5;
const SOURCE_CONCURRENCY = 4;

export type SourceResult = { sourceId: string; name: string; ok: boolean; items: number; inserted: number; error?: string };
export type ResearchResult = { sources: SourceResult[]; candidateIds: string[] };

/**
 * Itens recentes de um feed: com data nos últimos 3 dias, ou, se o feed não
 * publica datas, só os primeiros itens (os mais novos por convenção).
 */
export function selectRecentItems(items: FeedItem[], now: number, maxItems: number) {
  return items
    .filter((item, index) =>
      item.publishedAt ? now - Date.parse(item.publishedAt) <= MAX_AGE_MS : index < UNDATED_TOP_ITEMS,
    )
    .slice(0, maxItems);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

export async function researchSources(ctx: AgentContext): Promise<ResearchResult> {
  const { db } = ctx;
  const now = ctx.now?.() ?? Date.now();
  const settings = await getSettings(db);
  if (settings.automation_paused) return { sources: [], candidateIds: [] };

  let query = db.from("news_sources").select("id, name, feed_url, consecutive_failures").eq("enabled", true);
  if (settings.enabled_sources?.length) query = query.in("id", settings.enabled_sources);
  const { data: sources, error } = await query;
  if (error) throw new Error(`Falha ao ler fontes: ${error.message}`);

  const perSource = Math.max(1, Math.ceil(settings.max_candidates_per_run / Math.max(sources.length, 1)) + 2);
  const candidateIds: string[] = [];

  const results = await mapLimit(sources, SOURCE_CONCURRENCY, async (source): Promise<SourceResult> => {
    try {
      const response = await safeFetch(source.feed_url, { maxBytes: 10_000_000, timeoutMs: 20_000, sniffXml: true });
      const items = selectRecentItems(parseFeed(response.body, now), now, perSource);

      const rows = items.flatMap((item) => {
        const canonical = canonicalizeUrl(item.link);
        if (!canonical) return [];
        return [
          {
            source_id: source.id,
            original_url: item.link,
            canonical_url: canonical,
            original_title: item.title.slice(0, 500),
            summary: item.summary.slice(0, 5000) || null,
            source_published_at: item.publishedAt,
            fingerprint: titleFingerprint(item.title),
            title_tokens: titleTokens(item.title),
            metadata: { feed_url: source.feed_url, feed_image: item.imageUrl },
          },
        ];
      });

      let inserted = 0;
      if (rows.length > 0) {
        // canonical_url é único: itens já vistos são ignorados (idempotente entre coletas).
        const { data, error: insertError } = await db
          .from("news_candidates")
          .upsert(rows, { onConflict: "canonical_url", ignoreDuplicates: true })
          .select("id");
        if (insertError) throw new Error(`Falha ao gravar candidatos: ${insertError.message}`);
        inserted = data.length;
        candidateIds.push(...data.map((row) => row.id));
      }

      await db
        .from("news_sources")
        .update({ last_fetched_at: new Date(now).toISOString(), last_status: "ok", last_error: null, consecutive_failures: 0 })
        .eq("id", source.id);
      return { sourceId: source.id, name: source.name, ok: true, items: items.length, inserted };
    } catch (failure) {
      // Fonte fora do ar não derruba a coleta: registra e segue com as demais.
      const message =
        failure instanceof SafeFetchError || failure instanceof FeedParseError
          ? `${failure.name}: ${failure.message}`
          : failure instanceof Error
            ? failure.message
            : "Erro desconhecido";
      await db
        .from("news_sources")
        .update({
          last_fetched_at: new Date(now).toISOString(),
          last_status: "error",
          last_error: message.slice(0, 500),
          consecutive_failures: source.consecutive_failures + 1,
        })
        .eq("id", source.id);
      ctx.log?.("fonte indisponível", { source: source.name, error: message });
      return { sourceId: source.id, name: source.name, ok: false, items: 0, inserted: 0, error: message };
    }
  });

  return { sources: results, candidateIds };
}
