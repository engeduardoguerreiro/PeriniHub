import { z } from "zod";

import { runAgent } from "@/lib/ai/run-agent";
import { UNTRUSTED_RULES, wrapUntrusted } from "@/lib/ai/untrusted";

import { findDuplicate, preferredOrder, TRUST_RANK, type DedupeCandidate } from "./dedupe";
import { getSettings, type AgentContext } from "./types";

// Agente 2 — Curator. Primeiro deduplica sem IA (URL canônica já é única no
// banco; aqui entram fingerprint e similaridade de título). Depois pontua a
// relevância em lote com um modelo econômico. A decisão final de elegibilidade
// é uma regra fixa (nota mínima e categorias permitidas), não da IA.

const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 15;

type CandidateRow = {
  id: string;
  fingerprint: string;
  title_tokens: string[];
  fetched_at: string;
  original_title: string;
  summary: string | null;
  source_published_at: string | null;
  processing_status: string;
  metadata: Record<string, unknown> | null;
  source: { name: string; trust_level: keyof typeof TRUST_RANK } | null;
};

const CANDIDATE_FIELDS =
  "id, fingerprint, title_tokens, fetched_at, original_title, summary, source_published_at, processing_status, metadata, source:news_sources(name, trust_level)";

function toDedupe(row: CandidateRow): DedupeCandidate {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    titleTokens: row.title_tokens,
    fetchedAt: row.fetched_at,
    trustRank: TRUST_RANK[row.source?.trust_level ?? "medium"],
  };
}

export type DedupeResult = { checked: number; duplicates: number; possible: Record<string, string> };

/** Marca como duplicados os candidatos novos que repetem uma notícia já vista. */
export async function deduplicateCandidates(ctx: AgentContext, candidateIds?: string[]): Promise<DedupeResult> {
  const { db } = ctx;
  const now = ctx.now?.() ?? Date.now();
  const since = new Date(now - DEDUPE_WINDOW_MS).toISOString();

  const { data: pool, error } = await db
    .from("news_candidates")
    .select(CANDIDATE_FIELDS)
    .gte("fetched_at", since)
    .not("processing_status", "in", "(duplicate,discarded)")
    .returns<CandidateRow[]>();
  if (error) throw new Error(`Falha ao ler candidatos: ${error.message}`);

  const isTarget = (row: CandidateRow) =>
    row.processing_status === "new" && (!candidateIds || candidateIds.includes(row.id));
  // Processa do preferido para o menos preferido: o mais confiável/antigo vira o "original".
  const ordered = [...pool].sort((a, b) => preferredOrder(toDedupe(a), toDedupe(b)));
  const kept: DedupeCandidate[] = ordered.filter((row) => !isTarget(row)).map(toDedupe);
  const possible: Record<string, string> = {};
  let duplicates = 0;
  let checked = 0;

  for (const row of ordered.filter(isTarget)) {
    checked++;
    const candidate = toDedupe(row);
    const match = findDuplicate(candidate, kept);
    if (match && match.kind !== "possible") {
      duplicates++;
      await db
        .from("news_candidates")
        .update({ processing_status: "duplicate", duplicate_of: match.of, metadata: { ...row.metadata, dedupe: match } })
        .eq("id", row.id)
        .eq("processing_status", "new");
      continue;
    }
    if (match?.kind === "possible") possible[row.id] = match.of;
    kept.push(candidate);
  }

  return { checked, duplicates, possible };
}

const scoreSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        score: z.number(),
        reason: z.string(),
        category_slug: z.string(),
        same_event_as: z.string().nullable(),
        risk: z.enum(["low", "medium", "high"]),
        primary_source: z.boolean(),
      }),
    )
});

const CURATOR_SYSTEM = `Você é o curador editorial do PeriniHub Tech, portal brasileiro de notícias de tecnologia para desenvolvedores e empresas.
Para cada candidato, avalie de 0 a 100 o valor de publicar uma notícia original em português sobre ele, considerando:
atualidade, importância técnica, interesse do público brasileiro de tecnologia, credibilidade da fonte, se o documento é a fonte primária do anúncio, originalidade e potencial informativo.
Notas altas (80+): lançamentos relevantes, mudanças que afetam desenvolvedores, alertas de segurança com ação necessária.
Notas baixas (abaixo de 50): conteúdo promocional, eventos, cases de cliente, vagas, posts genéricos ou de nicho muito restrito.
Escolha a categoria mais adequada entre as permitidas.
Risco editorial "high": segurança com exploração ativa, temas jurídicos, financeiros, saúde ou acusações contra pessoas/empresas; "medium": vulnerabilidades sem exploração, mudanças de preço ou licença; "low": o resto.
Em same_event_as, informe o id de uma notícia da lista "já cobertas", ou de outro candidato deste lote, apenas se for exatamente o MESMO acontecimento (mesmo produto, mesma versão ou mesmo anúncio). Dentro do lote, aponte sempre do candidato menos informativo para o mais informativo. Atualizações diferentes do mesmo produto são eventos diferentes.
Responda sobre todos os candidatos recebidos, usando exatamente os ids fornecidos.

${UNTRUSTED_RULES}`;

export type ClassifyResult = { scored: number; eligible: string[]; discarded: number; duplicates: number };

/** Pontua candidatos novos (já deduplicados) e marca os elegíveis. */
export async function classifyCandidates(ctx: AgentContext, candidateIds?: string[]): Promise<ClassifyResult> {
  const { db } = ctx;
  const now = ctx.now?.() ?? Date.now();
  const settings = await getSettings(db);
  if (settings.automation_paused) return { scored: 0, eligible: [], discarded: 0, duplicates: 0 };

  const { data: categories, error: catError } = await db.from("news_categories").select("id, slug, name").eq("enabled", true);
  if (catError) throw new Error(`Falha ao ler categorias: ${catError.message}`);
  const allowed = categories.filter(
    (category) => !settings.allowed_categories?.length || settings.allowed_categories.includes(category.id),
  );
  if (allowed.length === 0) return { scored: 0, eligible: [], discarded: 0, duplicates: 0 };

  let query = db
    .from("news_candidates")
    .select(CANDIDATE_FIELDS)
    .eq("processing_status", "new")
    .order("fetched_at", { ascending: false })
    .limit(settings.max_candidates_per_run);
  if (candidateIds?.length) query = query.in("id", candidateIds);
  const { data: pending, error } = await query.returns<CandidateRow[]>();
  if (error) throw new Error(`Falha ao ler candidatos: ${error.message}`);
  if (pending.length === 0) return { scored: 0, eligible: [], discarded: 0, duplicates: 0 };

  // Notícias já em produção/elegíveis da última semana, para a deduplicação semântica.
  const { data: covered } = await db
    .from("news_candidates")
    .select("id, original_title")
    .in("processing_status", ["eligible", "drafted"])
    .gte("fetched_at", new Date(now - DEDUPE_WINDOW_MS).toISOString())
    .order("fetched_at", { ascending: false })
    .limit(40);

  const result: ClassifyResult = { scored: 0, eligible: [], discarded: 0, duplicates: 0 };
  const coveredIds = new Set((covered ?? []).map((row) => row.id));

  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const batchIds = new Set(batch.map((row) => row.id));
    const rowsById = new Map(batch.map((row) => [row.id, row]));
    const markedDuplicate = new Set<string>();
    const prompt = [
      `Categorias permitidas (use o slug): ${allowed.map((c) => `${c.slug} (${c.name})`).join(", ")}.`,
      "",
      "Notícias já cobertas recentemente (id: título):",
      (covered ?? []).map((row) => `- ${row.id}: ${row.original_title}`).join("\n") || "- nenhuma",
      "",
      "Candidatos:",
      wrapUntrusted(
        batch.map((row) => ({
          id: row.id,
          source: `${row.source?.name ?? "?"} (confiabilidade: ${row.source?.trust_level ?? "?"}; publicado: ${row.source_published_at ?? "sem data"})`,
          content: `Título: ${row.original_title}\nResumo: ${(row.summary ?? "").slice(0, 700)}`,
        })),
        1200,
      ),
    ].join("\n");

    const { data } = await runAgent({
      db,
      agent: "curator",
      system: CURATOR_SYSTEM,
      prompt,
      schema: scoreSchema,
      effort: "low",
      input: { candidate_ids: [...batchIds] },
      idempotencyKey: `curator:${[...batchIds].sort().join(",")}`.slice(0, 500),
      runId: ctx.runId,
    });

    // Ordena para que referências dentro do lote apontem para quem já foi avaliado como não duplicado.
    const items = [...data.items].sort((a, b) => Number(Boolean(a.same_event_as)) - Number(Boolean(b.same_event_as)));
    for (const item of items) {
      const row = rowsById.get(item.id);
      if (!row || !batchIds.has(item.id)) continue; // id inventado ou repetido pelo modelo: ignora
      batchIds.delete(item.id);
      result.scored++;
      const category = allowed.find((c) => c.slug === item.category_slug);
      const target = item.same_event_as;
      const validTarget =
        target !== null &&
        target !== item.id &&
        (coveredIds.has(target) || (rowsById.has(target) && !markedDuplicate.has(target)));
      const sameEvent = validTarget ? target : null;
      if (sameEvent) markedDuplicate.add(item.id);
      const score = Math.round(Math.min(100, Math.max(0, item.score)));
      const eligible = !sameEvent && Boolean(category) && score >= settings.min_relevance_score;
      const status = sameEvent ? "duplicate" : eligible ? "eligible" : "discarded";

      await db
        .from("news_candidates")
        .update({
          relevance_score: score,
          relevance_reason: item.reason.slice(0, 400),
          processing_status: status,
          duplicate_of: sameEvent,
          metadata: {
            ...row.metadata,
            category_slug: category?.slug ?? null,
            risk: item.risk,
            primary_source: item.primary_source,
            curated_at: new Date(now).toISOString(),
          },
        })
        .eq("id", item.id)
        .eq("processing_status", "new");

      if (status === "eligible") result.eligible.push(item.id);
      else if (status === "duplicate") result.duplicates++;
      else result.discarded++;
    }
    // Candidatos que o modelo omitiu continuam "new" e entram na próxima rodada.
  }

  return result;
}
