import { NEWS_TAGS } from "@/lib/news/cache-tags";
import { sign } from "@/lib/news/revalidate-signature";
import { requireSecret } from "@/lib/env";

import { AgentError } from "@/lib/ai/errors";

import type { AgentContext } from "./types";

// Agente 6 — Publisher. Não decide nada sozinho: chama a função do banco
// news_publish_article, que confere aprovação, verificação, limite diário e
// pausa numa transação (idempotente). Depois pede ao site para invalidar o cache.

/** Erros esperados da função de publicação: não são falhas do sistema. */
export const PUBLISH_BLOCKERS = [
  "not_approved",
  "not_due",
  "verification_blocked",
  "verification_required",
  "unsupported_claims",
  "automation_paused",
  "auto_publish_disabled",
  "approval_required",
  "high_risk_requires_approval",
  "daily_limit_reached",
] as const;
export type PublishBlocker = (typeof PUBLISH_BLOCKERS)[number];

export type PublishResult =
  | { published: true; articleId: string; slug: string; publishedAt: string; revalidated: boolean }
  | { published: false; articleId: string; blocker: PublishBlocker };

/** Pede ao site (Vercel) para invalidar as tags do portal. Assinado com HMAC. */
export async function revalidateSite(tags: string[], mode: "max" | "expire" = "max") {
  const body = JSON.stringify({ tags, mode, ts: Date.now() });
  const response = await fetch(new URL("/api/news/revalidate", requireSecret("NEWS_SITE_URL")), {
    method: "POST",
    headers: { "content-type": "application/json", "x-news-signature": sign(body, requireSecret("NEWS_REVALIDATE_SECRET")) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AgentError(`Revalidação do site falhou: HTTP ${response.status}`, "revalidate_failed", true);
}

export async function publishArticle(
  ctx: AgentContext,
  articleId: string,
  mode: "auto" | "manual" = "auto",
): Promise<PublishResult> {
  const { data, error } = await ctx.db.rpc("news_publish_article", { p_article_id: articleId, p_mode: mode });
  if (error) {
    const blocker = PUBLISH_BLOCKERS.find((code) => error.message.includes(code));
    if (blocker) return { published: false, articleId, blocker };
    throw new AgentError(`Falha ao publicar: ${error.message}`, "publish_failed", true);
  }

  // A publicação já está gravada; se a revalidação falhar, o retry da tarefa
  // chama a função de novo (idempotente) e tenta revalidar outra vez.
  await revalidateSite([NEWS_TAGS.list, NEWS_TAGS.article(data.slug)]);
  return { published: true, articleId, slug: data.slug, publishedAt: data.published_at ?? "", revalidated: true };
}
