import { AbortTaskRunError, idempotencyKeys, logger, schedules, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { classifyCandidates, deduplicateCandidates } from "@/agents/curator";
import { verifyArticle } from "@/agents/fact-checker";
import { publishArticle } from "@/agents/publisher";
import { researchSources } from "@/agents/researcher";
import { prepareSeo } from "@/agents/seo-editor";
import { getSettings, localDate, startOf, type AgentContext, type Db } from "@/agents/types";
import { writeArticle } from "@/agents/writer";
import { AgentError } from "@/lib/ai/errors";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";

import { dueCollectionSlots, writingCapacity } from "./schedule";

// Pipeline do PeriniHub Tech. Cada etapa é uma tarefa separada e persistente:
// falha em uma não refaz as anteriores. Idempotência em duas camadas:
// chaves do Trigger.dev ao disparar e restrições únicas/funções no banco.
//
//   news-scheduler (a cada 15 min) ─┬─> fetch-news-sources ─> deduplicate-news ─> classify-news
//                                    │       └─> generate-article ─> verify-article ─> prepare-article-seo
//                                    └─> publish-approved-article (agendados / auto) <───────────┘
//   daily-news-report (20h)

const TZ = "America/Sao_Paulo";

function context(runId: string): AgentContext {
  return {
    db: createServiceClient(),
    runId,
    log: (message, data) => logger.info(message, data),
  };
}

/** Erro definitivo (recusa, orçamento, pausa, dados inválidos) não deve gastar retries. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AgentError && !error.retryable) {
      logger.warn("falha definitiva", { code: error.code, message: error.message });
      throw new AbortTaskRunError(`${error.code}: ${error.message}`);
    }
    throw error;
  }
}

function globalKey(key: string) {
  return idempotencyKeys.create(key, { scope: "global" });
}

/** Registro de agentes sem IA (custo zero) para o histórico e o painel. */
async function recordRun(
  db: Db,
  agent: "researcher" | "publisher" | "pipeline",
  runId: string,
  startedAt: Date,
  outcome: { status: "succeeded" | "failed" | "skipped"; input?: Record<string, Json>; output?: Json; error?: string },
) {
  await db.from("news_agent_runs").insert({
    agent_name: agent,
    run_id: runId,
    status: outcome.status,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    latency_ms: Date.now() - startedAt.getTime(),
    input_reference: outcome.input ?? {},
    output_reference: outcome.output ?? null,
    error_details: outcome.error ? { message: outcome.error.slice(0, 1000) } : null,
    estimated_cost: 0,
    actual_cost_if_available: 0,
  });
}

// --- Coleta -----------------------------------------------------------------

export const fetchNewsSources = schemaTask({
  id: "fetch-news-sources",
  schema: z.object({ reason: z.string().max(100).default("agendado") }),
  concurrency: { total: 1 },
  maxDuration: 600,
  retry: { maxAttempts: 2, minTimeoutInMs: 30_000, maxTimeoutInMs: 120_000, factor: 2 },
  run: async ({ reason }, { ctx }) => {
    const agent = context(ctx.run.id);
    const startedAt = new Date();
    const result = await researchSources(agent);
    const failed = result.sources.filter((source) => !source.ok);
    await recordRun(agent.db, "researcher", ctx.run.id, startedAt, {
      status: result.sources.length === 0 ? "skipped" : "succeeded",
      input: { reason },
      output: {
        sources: result.sources.length,
        failed: failed.map((source) => ({ name: source.name, error: source.error ?? null })),
        inserted: result.candidateIds.length,
      },
    });
    logger.info("coleta concluída", { fontes: result.sources.length, falhas: failed.length, novos: result.candidateIds.length });

    if (result.candidateIds.length > 0) {
      await deduplicateNews.trigger(
        { candidateIds: result.candidateIds },
        { idempotencyKey: await globalKey(`dedupe:${ctx.run.id}`) },
      );
    }
    return { sources: result.sources.length, failed: failed.length, inserted: result.candidateIds.length };
  },
});

export const deduplicateNews = schemaTask({
  id: "deduplicate-news",
  schema: z.object({ candidateIds: z.array(z.uuid()).max(500) }),
  concurrency: { total: 1 },
  maxDuration: 120,
  run: async ({ candidateIds }, { ctx }) => {
    const agent = context(ctx.run.id);
    const result = await deduplicateCandidates(agent, candidateIds);
    logger.info("deduplicação", { ...result, possible: Object.keys(result.possible).length });
    await classifyNews.trigger({ candidateIds }, { idempotencyKey: await globalKey(`classify:${ctx.run.id}`) });
    return result;
  },
});

export const classifyNews = schemaTask({
  id: "classify-news",
  schema: z.object({ candidateIds: z.array(z.uuid()).max(500).optional() }),
  concurrency: { total: 1 },
  maxDuration: 300,
  retry: { maxAttempts: 3, minTimeoutInMs: 10_000, maxTimeoutInMs: 120_000, factor: 2, randomize: true },
  run: async ({ candidateIds }, { ctx }) => {
    const agent = context(ctx.run.id);
    const result = await guarded(() => classifyCandidates(agent, candidateIds));
    logger.info("curadoria", { pontuados: result.scored, elegiveis: result.eligible.length, descartados: result.discarded });
    const started = await startWriting(agent, ctx.run.id);
    return { ...result, writing: started };
  },
});

/** Dispara redação para os melhores elegíveis, respeitando a capacidade diária. */
async function startWriting(agent: AgentContext, runId: string) {
  const { db } = agent;
  const settings = await getSettings(db);
  if (settings.automation_paused) return 0;

  const { count } = await db
    .from("news_articles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOf("day", settings.timezone));
  const capacity = writingCapacity(settings.daily_publication_limit, count ?? 0);
  if (capacity === 0) return 0;

  const { data: eligible } = await db
    .from("news_candidates")
    .select("id, attempts")
    .eq("processing_status", "eligible")
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
    .order("relevance_score", { ascending: false })
    .limit(capacity);

  for (const candidate of eligible ?? []) {
    await generateArticle.trigger(
      { candidateId: candidate.id },
      { idempotencyKey: await globalKey(`generate:${candidate.id}:${candidate.attempts}`), idempotencyKeyTTL: "2d" },
    );
  }
  logger.info("redação disparada", { capacidade: capacity, disparados: eligible?.length ?? 0, run: runId });
  return eligible?.length ?? 0;
}

// --- Produção do artigo -----------------------------------------------------

export const generateArticle = schemaTask({
  id: "generate-article",
  schema: z.object({ candidateId: z.uuid() }),
  concurrency: { total: 2 },
  maxDuration: 600,
  retry: { maxAttempts: 3, minTimeoutInMs: 15_000, maxTimeoutInMs: 300_000, factor: 3, randomize: true },
  run: async ({ candidateId }, { ctx }) => {
    const agent = context(ctx.run.id);
    const result = await guarded(() => writeArticle(agent, candidateId));
    if ("skipped" in result) {
      logger.info("redação ignorada", { candidateId, motivo: result.skipped });
      return result;
    }
    await verifyArticleTask.trigger(
      { articleId: result.articleId },
      { idempotencyKey: await globalKey(`verify:${result.articleId}:auto`) },
    );
    return result;
  },
  // Dead letter: depois do último retry o candidato sai da fila automática.
  onFailure: async ({ payload, error }) => {
    const db = createServiceClient();
    await db
      .from("news_candidates")
      .update({ processing_status: "dead_letter", last_error: String(error).slice(0, 1000), locked_until: null })
      .eq("id", payload.candidateId)
      .in("processing_status", ["eligible", "failed"]);
  },
});

export const verifyArticleTask = schemaTask({
  id: "verify-article",
  schema: z.object({ articleId: z.uuid() }),
  concurrency: { total: 2 },
  maxDuration: 600,
  retry: { maxAttempts: 3, minTimeoutInMs: 15_000, maxTimeoutInMs: 300_000, factor: 3, randomize: true },
  run: async ({ articleId }, { ctx }) => {
    const agent = context(ctx.run.id);
    const result = await guarded(() => verifyArticle(agent, articleId));
    logger.info("verificação", { articleId, veredito: result.verdict, afirmacoes: result.claims });
    await prepareArticleSeo.trigger({ articleId }, { idempotencyKey: await globalKey(`seo:${articleId}:${result.verdict}`) });
    return result;
  },
  // Sem verificação concluída, o artigo nunca segue sozinho: bloqueia para revisão humana.
  onFailure: async ({ payload, error }) => {
    const db = createServiceClient();
    await db
      .from("news_articles")
      .update({
        status: "blocked",
        verification_status: "unverified",
        review_notes: `Verificação automática falhou: ${String(error).slice(0, 500)}`,
      })
      .eq("id", payload.articleId)
      .in("status", ["draft", "needs_review"]);
  },
});

export const prepareArticleSeo = schemaTask({
  id: "prepare-article-seo",
  schema: z.object({ articleId: z.uuid() }),
  concurrency: { total: 2 },
  maxDuration: 300,
  retry: { maxAttempts: 3, minTimeoutInMs: 10_000, maxTimeoutInMs: 120_000, factor: 2, randomize: true },
  run: async ({ articleId }, { ctx }) => {
    const agent = context(ctx.run.id);
    const result = await guarded(() => prepareSeo(agent, articleId));
    const settings = await getSettings(agent.db);
    if (result.status === "approved" && settings.auto_publish_enabled && !settings.automation_paused) {
      await publishApprovedArticle.trigger(
        { articleId, mode: "auto" },
        { idempotencyKey: await globalKey(`publish:${articleId}:${localDate(settings.timezone)}`) },
      );
    }
    return result;
  },
  // SEO é acessório: se falhar, o artigo vai para revisão com os metadados padrão.
  onFailure: async ({ payload }) => {
    const db = createServiceClient();
    await db.from("news_articles").update({ status: "needs_review" }).eq("id", payload.articleId).eq("status", "draft");
  },
});

export const publishApprovedArticle = schemaTask({
  id: "publish-approved-article",
  schema: z.object({ articleId: z.uuid(), mode: z.enum(["auto", "manual"]).default("auto") }),
  concurrency: { total: 1 },
  maxDuration: 120,
  retry: { maxAttempts: 4, minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async ({ articleId, mode }, { ctx }) => {
    const agent = context(ctx.run.id);
    const startedAt = new Date();
    try {
      const result = await guarded(() => publishArticle(agent, articleId, mode));
      await recordRun(agent.db, "publisher", ctx.run.id, startedAt, {
        status: result.published ? "succeeded" : "skipped",
        input: { article_id: articleId, mode },
        output: result.published ? { slug: result.slug, published_at: result.publishedAt } : { blocker: result.blocker },
      });
      return result;
    } catch (error) {
      await recordRun(agent.db, "publisher", ctx.run.id, startedAt, {
        status: "failed",
        input: { article_id: articleId, mode },
        error: String(error),
      });
      throw error;
    }
  },
});

// --- Agendamentos -----------------------------------------------------------

/**
 * Relógio do pipeline. Roda a cada 15 minutos e decide o que fazer a partir
 * das configurações do painel (horários de coleta editáveis, pausa, publicação
 * automática), além de recuperar etapas interrompidas.
 */
export const newsScheduler = schedules.task({
  id: "news-scheduler",
  // Só em ambientes implantados: em DEV os ticks se acumulariam enquanto o CLI está parado.
  cron: { pattern: "*/15 * * * *", timezone: TZ, environments: ["PRODUCTION", "STAGING"] },
  maxDuration: 120,
  run: async (_payload, { ctx }) => {
    const db = createServiceClient();
    const settings = await getSettings(db);
    if (settings.automation_paused) {
      logger.info("automação pausada");
      return { paused: true };
    }
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const summary = { collections: 0, scheduled: 0, autoPublish: 0, recovered: 0, deadLetter: 0 };

    for (const slot of dueCollectionSlots(settings.schedule_times, settings.timezone, now)) {
      await fetchNewsSources.trigger(
        { reason: `agendado ${slot.time}` },
        { idempotencyKey: await globalKey(slot.key), idempotencyKeyTTL: "2d" },
      );
      summary.collections++;
    }

    // Agendados por um editor: publicam no horário, mesmo com publicação automática desligada.
    const { data: due } = await db.from("news_articles").select("id").eq("status", "scheduled").lte("scheduled_for", nowIso).limit(10);
    for (const article of due ?? []) {
      await publishApprovedArticle.trigger(
        { articleId: article.id, mode: "manual" },
        { idempotencyKey: await globalKey(`publish:${article.id}:scheduled`) },
      );
      summary.scheduled++;
    }

    if (settings.auto_publish_enabled) {
      const { data: approved } = await db.from("news_articles").select("id").eq("status", "approved").order("updated_at").limit(5);
      for (const article of approved ?? []) {
        await publishApprovedArticle.trigger(
          { articleId: article.id, mode: "auto" },
          { idempotencyKey: await globalKey(`publish:${article.id}:${localDate(settings.timezone, now)}`) },
        );
        summary.autoPublish++;
      }
    }

    // Recuperação: candidatos elegíveis parados (execução interrompida) voltam à fila;
    // depois de 3 tentativas vão para dead letter.
    const stale = new Date(now - 30 * 60 * 1000).toISOString();
    const { data: stuck } = await db
      .from("news_candidates")
      .select("id, attempts")
      .eq("processing_status", "eligible")
      .gt("attempts", 0)
      .lt("updated_at", stale)
      .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
      .limit(10);
    for (const candidate of stuck ?? []) {
      if (candidate.attempts >= 3) {
        await db
          .from("news_candidates")
          .update({ processing_status: "dead_letter", last_error: "Excedeu 3 tentativas de redação" })
          .eq("id", candidate.id);
        summary.deadLetter++;
      }
    }
    const recovered = await startWriting(context(ctx.run.id), ctx.run.id);
    summary.recovered = recovered;

    // Rascunhos sem verificação há mais de 30 minutos (etapa perdida).
    const { data: unverified } = await db
      .from("news_articles")
      .select("id, updated_at")
      .eq("status", "draft")
      .eq("verification_status", "pending")
      .lt("updated_at", stale)
      .limit(5);
    for (const article of unverified ?? []) {
      await verifyArticleTask.trigger(
        { articleId: article.id },
        { idempotencyKey: await globalKey(`verify:${article.id}:recover:${article.updated_at}`) },
      );
    }

    logger.info("agendador", summary);
    return summary;
  },
});

export const dailyNewsReport = schedules.task({
  id: "daily-news-report",
  cron: { pattern: "0 20 * * *", timezone: TZ, environments: ["PRODUCTION", "STAGING"] },
  maxDuration: 60,
  run: async (_payload, { ctx }) => {
    const db = createServiceClient();
    const startedAt = new Date();
    const settings = await getSettings(db);
    const dayStart = startOf("day", settings.timezone);
    const monthStart = startOf("month", settings.timezone);

    const [candidates, published, pending, runsToday, runsMonth, sources] = await Promise.all([
      db.from("news_candidates").select("processing_status").gte("fetched_at", dayStart),
      db.from("news_articles").select("slug, title").eq("status", "published").gte("published_at", dayStart),
      db.from("news_articles").select("id", { count: "exact", head: true }).in("status", ["needs_review", "blocked", "draft"]),
      db.from("news_agent_runs").select("agent_name, status, estimated_cost, actual_cost_if_available").gte("started_at", dayStart),
      db.from("news_agent_runs").select("estimated_cost, actual_cost_if_available").gte("started_at", monthStart),
      db.from("news_sources").select("name, last_status, consecutive_failures").eq("enabled", true).gt("consecutive_failures", 2),
    ]);

    const cost = (rows: { estimated_cost: number; actual_cost_if_available: number | null }[] | null) =>
      Number((rows ?? []).reduce((sum, row) => sum + Number(row.actual_cost_if_available ?? row.estimated_cost), 0).toFixed(4));
    const byStatus: Record<string, number> = {};
    for (const row of candidates.data ?? []) byStatus[row.processing_status] = (byStatus[row.processing_status] ?? 0) + 1;

    const report = {
      date: localDate(settings.timezone),
      candidates: byStatus,
      published: published.data ?? [],
      pending_review: pending.count ?? 0,
      failures: (runsToday.data ?? []).filter((run) => run.status === "failed").map((run) => run.agent_name),
      cost_today_usd: cost(runsToday.data),
      cost_month_usd: cost(runsMonth.data),
      monthly_limit_usd: Number(settings.monthly_cost_limit),
      unhealthy_sources: (sources.data ?? []).map((source) => source.name),
    };
    await recordRun(db, "pipeline", ctx.run.id, startedAt, { status: "succeeded", input: { report: "daily" }, output: report });
    logger.info("relatório diário", report);
    return report;
  },
});
