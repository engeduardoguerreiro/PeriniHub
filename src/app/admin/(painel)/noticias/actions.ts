"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { parseFeed } from "@/lib/news/feed-parser";
import { requireAdmin, requireEditor } from "@/lib/auth/admin";
import { NEWS_TAGS } from "@/lib/news/cache-tags";
import { isValidSlug } from "@/lib/news/slug";
import { dispatchGenerate, dispatchResearch, dispatchVerify } from "@/lib/pipeline/dispatch";
import { assertPublicUrl, safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";
import { createSessionClient } from "@/lib/supabase/server";

// Ações do painel. Cada uma confere o papel no servidor, valida a entrada,
// grava com a sessão do usuário (o RLS também barra) e invalida o cache
// público quando muda algo visível no portal. A trilha de auditoria é
// gravada pelos triggers do banco, com o usuário da sessão como autor.

export type ActionResult = { ok: boolean; message: string };

const uuid = z.uuid();

function fail(message: string): ActionResult {
  return { ok: false, message };
}

/** Mensagens das funções do banco traduzidas para o editor. */
const DB_MESSAGES: Record<string, string> = {
  not_approved: "O artigo precisa estar aprovado ou agendado.",
  not_due: "O horário agendado ainda não chegou.",
  verification_blocked: "Verificação bloqueou o artigo: aprove-o depois de revisar.",
  verification_required: "Artigo sem verificação concluída: aprove-o depois de revisar.",
  unsupported_claims: "Há afirmações sem suporte: revise e aprove manualmente.",
  daily_limit_reached: "Limite diário de publicações atingido.",
  publish_via_function_only: "Publicação só pelo botão Publicar.",
  not_authorized: "Sem permissão para esta ação.",
};

function dbMessage(message: string) {
  const code = Object.keys(DB_MESSAGES).find((key) => message.includes(key));
  return code ? DB_MESSAGES[code] : "Não foi possível concluir. Tente novamente.";
}

function invalidateArticle(slug: string) {
  updateTag(NEWS_TAGS.list);
  updateTag(NEWS_TAGS.article(slug));
}

// --- Automação ----------------------------------------------------------------

export async function runResearchNow(): Promise<ActionResult> {
  const user = await requireEditor();
  try {
    await dispatchResearch(user.id);
    return { ok: true, message: "Pesquisa iniciada. Os candidatos aparecem em alguns minutos." };
  } catch (error) {
    console.error("[painel] falha ao disparar pesquisa:", error instanceof Error ? error.message : error);
    return fail("Não foi possível iniciar a pesquisa (Trigger.dev configurado?).");
  }
}

export async function setAutomationPaused(paused: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  const db = await createSessionClient();
  const { error } = await db
    .from("news_editorial_settings")
    .update({ automation_paused: paused, updated_by: user.id })
    .eq("id", 1);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: paused ? "Automações pausadas." : "Automações retomadas." };
}

// --- Artigos ------------------------------------------------------------------

async function loadArticle(id: string) {
  const db = await createSessionClient();
  const { data, error } = await db.from("news_articles").select("id, slug, status, content, updated_at").eq("id", id).single();
  return { db, article: error ? null : data };
}

export async function approveArticle(articleId: string): Promise<ActionResult> {
  await requireEditor();
  if (!uuid.safeParse(articleId).success) return fail("Artigo inválido.");
  const { db, article } = await loadArticle(articleId);
  if (!article) return fail("Artigo não encontrado.");
  if (!["draft", "needs_review", "blocked", "rejected"].includes(article.status)) return fail("Este artigo não pode ser aprovado agora.");
  // approved_by/approved_at são preenchidos pelo trigger com o usuário da sessão.
  const { error } = await db.from("news_articles").update({ status: "approved" }).eq("id", articleId);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: "Artigo aprovado." };
}

const rejectSchema = z.object({ articleId: uuid, reason: z.string().trim().min(3).max(1000) });

export async function rejectArticle(input: { articleId: string; reason: string }): Promise<ActionResult> {
  await requireEditor();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail("Informe o motivo da rejeição (mínimo 3 caracteres).");
  const { db, article } = await loadArticle(parsed.data.articleId);
  if (!article) return fail("Artigo não encontrado.");
  if (article.status === "published") return fail("Artigo publicado: use Arquivar.");
  const { error } = await db
    .from("news_articles")
    .update({ status: "rejected", review_notes: `Rejeitado: ${parsed.data.reason}` })
    .eq("id", parsed.data.articleId);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: "Artigo rejeitado." };
}

const scheduleSchema = z.object({
  articleId: uuid,
  // datetime-local do navegador, interpretado no fuso editorial (America/Sao_Paulo, UTC-3).
  when: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export async function scheduleArticle(input: { articleId: string; when: string }): Promise<ActionResult> {
  await requireEditor();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail("Data e hora inválidas.");
  const when = new Date(`${parsed.data.when}:00-03:00`);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 5 * 60 * 1000) {
    return fail("Agende para pelo menos 5 minutos no futuro.");
  }
  const { db, article } = await loadArticle(parsed.data.articleId);
  if (!article) return fail("Artigo não encontrado.");
  if (!["approved", "needs_review", "blocked", "scheduled"].includes(article.status)) return fail("Este artigo não pode ser agendado.");
  const { error } = await db
    .from("news_articles")
    .update({ status: "scheduled", scheduled_for: when.toISOString() })
    .eq("id", parsed.data.articleId);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: `Agendado para ${parsed.data.when.replace("T", " às ")}.` };
}

export async function publishArticleNow(articleId: string): Promise<ActionResult> {
  await requireEditor();
  if (!uuid.safeParse(articleId).success) return fail("Artigo inválido.");
  const db = await createSessionClient();
  // A função valida aprovação, verificação e limite diário numa transação.
  const { data, error } = await db.rpc("news_publish_article", { p_article_id: articleId, p_mode: "manual" });
  if (error) return fail(dbMessage(error.message));
  invalidateArticle(data.slug);
  return { ok: true, message: "Artigo publicado." };
}

export async function archiveArticle(articleId: string): Promise<ActionResult> {
  await requireEditor();
  if (!uuid.safeParse(articleId).success) return fail("Artigo inválido.");
  const { db, article } = await loadArticle(articleId);
  if (!article) return fail("Artigo não encontrado.");
  const { error } = await db.from("news_articles").update({ status: "archived" }).eq("id", articleId);
  if (error) return fail(dbMessage(error.message));
  // Sai do ar imediatamente (sem servir versão em cache).
  if (article.status === "published") invalidateArticle(article.slug);
  return { ok: true, message: article.status === "published" ? "Artigo retirado do ar." : "Artigo arquivado." };
}

const editSchema = z.object({
  articleId: uuid,
  title: z.string().trim().min(10).max(160),
  subtitle: z.string().trim().max(300),
  excerpt: z.string().trim().min(20).max(400),
  content: z.string().trim().min(200).max(40_000),
  categoryId: z.union([uuid, z.literal("")]),
  slug: z.string().trim().refine((value) => isValidSlug(value, 120), "slug inválido"),
});

export async function updateArticle(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireEditor();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`Campo inválido: ${String(issue?.path[0] ?? "")} (${issue?.message ?? ""}).`);
  }
  const { articleId, title, subtitle, excerpt, content, categoryId, slug } = parsed.data;
  const { db, article } = await loadArticle(articleId);
  if (!article) return fail("Artigo não encontrado.");
  if (article.status === "published" && slug !== article.slug) return fail("Não altere o slug de um artigo publicado (quebraria links).");

  // Mudança de texto em artigo aprovado volta para revisão (regra do banco).
  const { error } = await db
    .from("news_articles")
    .update({ title, subtitle: subtitle || null, excerpt, content, category_id: categoryId || null, slug })
    .eq("id", articleId);
  if (error) return fail(error.message.includes("duplicate key") ? "Já existe um artigo com esse slug." : dbMessage(error.message));
  if (article.status === "published") invalidateArticle(article.slug);
  return { ok: true, message: "Alterações salvas." };
}

export async function reverifyArticle(articleId: string): Promise<ActionResult> {
  await requireEditor();
  if (!uuid.safeParse(articleId).success) return fail("Artigo inválido.");
  const { db, article } = await loadArticle(articleId);
  if (!article) return fail("Artigo não encontrado.");
  if (!["draft", "needs_review", "blocked"].includes(article.status)) return fail("Reverificação só para rascunhos e artigos em revisão.");
  await db.from("news_articles").update({ status: "needs_review", verification_status: "pending" }).eq("id", articleId);
  try {
    await dispatchVerify(articleId, article.updated_at);
    return { ok: true, message: "Nova verificação iniciada." };
  } catch {
    return fail("Não foi possível iniciar a verificação (Trigger.dev configurado?).");
  }
}

// --- Candidatos ---------------------------------------------------------------

export async function reprocessCandidate(candidateId: string): Promise<ActionResult> {
  await requireEditor();
  if (!uuid.safeParse(candidateId).success) return fail("Candidato inválido.");
  const db = await createSessionClient();
  const { data: candidate } = await db.from("news_candidates").select("id, processing_status, attempts").eq("id", candidateId).single();
  if (!candidate) return fail("Candidato não encontrado.");
  if (!["failed", "dead_letter", "discarded", "eligible"].includes(candidate.processing_status)) {
    return fail("Só candidatos com falha, descartados ou elegíveis podem ser reprocessados.");
  }
  const { data: existing } = await db.from("news_articles").select("id").eq("candidate_id", candidateId).maybeSingle();
  if (existing) return fail("Este candidato já tem artigo; use Reverificar no artigo.");

  const { error } = await db
    .from("news_candidates")
    .update({ processing_status: "eligible", last_error: null, locked_until: null, attempts: 0 })
    .eq("id", candidateId);
  if (error) return fail(dbMessage(error.message));
  try {
    await dispatchGenerate(candidateId, new Date().toISOString());
    return { ok: true, message: "Candidato reenviado para redação." };
  } catch {
    return { ok: true, message: "Candidato voltou para a fila; a redação começa no próximo ciclo do agendador." };
  }
}

// --- Fontes -------------------------------------------------------------------

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  websiteUrl: z.url({ protocol: /^https$/ }),
  feedUrl: z.url({ protocol: /^https$/ }),
  categoryId: z.union([uuid, z.literal("")]),
  trustLevel: z.enum(["official", "high", "medium", "low"]),
});

export async function createSource(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Confira os campos: nome e URLs https válidas.");
  const { name, websiteUrl, feedUrl, categoryId, trustLevel } = parsed.data;

  // Valida o feed antes de cadastrar: mesma proteção SSRF do coletor.
  try {
    assertPublicUrl(feedUrl);
    const response = await safeFetch(feedUrl, { maxBytes: 10_000_000, sniffXml: true });
    if (parseFeed(response.body).length === 0) return fail("O feed respondeu, mas não tem itens.");
  } catch (error) {
    return fail(error instanceof SafeFetchError ? `Feed recusado: ${error.message}` : "Não foi possível ler o feed (RSS/Atom).");
  }

  const db = await createSessionClient();
  const { error } = await db.from("news_sources").insert({
    name,
    website_url: websiteUrl,
    feed_url: feedUrl,
    category_id: categoryId || null,
    trust_level: trustLevel,
  });
  if (error) return fail(error.message.includes("duplicate key") ? "Este feed já está cadastrado." : dbMessage(error.message));
  return { ok: true, message: "Fonte cadastrada." };
}

export async function setSourceEnabled(sourceId: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(sourceId).success) return fail("Fonte inválida.");
  const db = await createSessionClient();
  const { error } = await db.from("news_sources").update({ enabled }).eq("id", sourceId);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: enabled ? "Fonte ativada." : "Fonte desativada." };
}

// --- Configurações -------------------------------------------------------------

const settingsSchema = z.object({
  approvalRequired: z.boolean(),
  autoPublishEnabled: z.boolean(),
  dailyPublicationLimit: z.coerce.number().int().min(0).max(50),
  minRelevanceScore: z.coerce.number().int().min(0).max(100),
  maxCandidatesPerRun: z.coerce.number().int().min(1).max(100),
  monthlyCostLimit: z.coerce.number().min(0).max(1000),
  scheduleTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5][05]$/, "horários em HH:MM, múltiplos de 5 minutos"))
    .min(1)
    .max(12),
  allowedCategories: z.array(uuid),
});

export async function updateSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    approvalRequired: formData.get("approvalRequired") === "on",
    autoPublishEnabled: formData.get("autoPublishEnabled") === "on",
    dailyPublicationLimit: formData.get("dailyPublicationLimit"),
    minRelevanceScore: formData.get("minRelevanceScore"),
    maxCandidatesPerRun: formData.get("maxCandidatesPerRun"),
    monthlyCostLimit: formData.get("monthlyCostLimit"),
    scheduleTimes: String(formData.get("scheduleTimes") ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean),
    allowedCategories: formData.getAll("allowedCategories").map(String),
  });
  if (!parsed.success) return fail(`Configuração inválida: ${parsed.error.issues[0]?.message ?? "confira os campos"}.`);
  const value = parsed.data;

  const db = await createSessionClient();
  const { error } = await db
    .from("news_editorial_settings")
    .update({
      approval_required: value.approvalRequired,
      auto_publish_enabled: value.autoPublishEnabled,
      daily_publication_limit: value.dailyPublicationLimit,
      min_relevance_score: value.minRelevanceScore,
      max_candidates_per_run: value.maxCandidatesPerRun,
      monthly_cost_limit: value.monthlyCostLimit,
      schedule_times: [...new Set(value.scheduleTimes)].sort(),
      allowed_categories: value.allowedCategories.length > 0 ? value.allowedCategories : null,
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: "Configurações salvas." };
}

export async function setCategoryEnabled(categoryId: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(categoryId).success) return fail("Categoria inválida.");
  const db = await createSessionClient();
  const { error } = await db.from("news_categories").update({ enabled }).eq("id", categoryId);
  if (error) return fail(dbMessage(error.message));
  updateTag(NEWS_TAGS.categories);
  updateTag(NEWS_TAGS.list);
  return { ok: true, message: enabled ? "Categoria ativada." : "Categoria desativada." };
}

// --- Modelos de IA ---------------------------------------------------------------

const modelSchema = z.object({
  agentName: z.enum(["researcher", "curator", "writer", "fact_checker", "seo_editor"]),
  provider: z.enum(["anthropic"]),
  model: z.string().trim().regex(/^[a-z0-9][a-z0-9.\-]{2,80}$/, "id de modelo inválido"),
  maxOutputTokens: z.coerce.number().int().min(256).max(32_000),
  inputPrice: z.coerce.number().min(0).max(1000),
  outputPrice: z.coerce.number().min(0).max(1000),
  enabled: z.boolean(),
});

export async function updateAgentModel(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = modelSchema.safeParse({
    agentName: formData.get("agentName"),
    provider: formData.get("provider"),
    model: formData.get("model"),
    maxOutputTokens: formData.get("maxOutputTokens"),
    inputPrice: formData.get("inputPrice"),
    outputPrice: formData.get("outputPrice"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return fail(`Configuração inválida: ${parsed.error.issues[0]?.message ?? "confira os campos"}.`);
  const value = parsed.data;
  const db = await createSessionClient();
  const { error } = await db
    .from("news_agent_models")
    .update({
      provider: value.provider,
      model: value.model,
      max_output_tokens: value.maxOutputTokens,
      input_price_per_mtok: value.inputPrice,
      output_price_per_mtok: value.outputPrice,
      enabled: value.enabled,
    })
    .eq("agent_name", value.agentName);
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: "Modelo atualizado." };
}
