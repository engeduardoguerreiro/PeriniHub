import "server-only";

import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import { requireSecret } from "@/lib/env";
import type { fetchNewsSources, generateArticle, publishApprovedArticle, verifyArticleTask } from "@/trigger/news";

// O site só dispara tarefas no Trigger.dev; nunca executa o pipeline numa
// requisição. Imports de tipo: o código das tarefas não entra no bundle da Vercel.

function ensureConfigured() {
  requireSecret("TRIGGER_SECRET_KEY"); // o SDK lê process.env.TRIGGER_SECRET_KEY
}

const key = (value: string) => idempotencyKeys.create(value, { scope: "global" });

export async function dispatchResearch(requestedBy: string) {
  ensureConfigured();
  // Um clique por minuto no máximo: cliques repetidos viram a mesma execução.
  const minute = new Date().toISOString().slice(0, 16);
  return tasks.trigger<typeof fetchNewsSources>(
    "fetch-news-sources",
    { reason: "manual" },
    { idempotencyKey: await key(`manual-research:${minute}`), tags: [`user:${requestedBy}`] },
  );
}

export async function dispatchGenerate(candidateId: string, attempt: string) {
  ensureConfigured();
  return tasks.trigger<typeof generateArticle>(
    "generate-article",
    { candidateId },
    { idempotencyKey: await key(`generate:${candidateId}:manual:${attempt}`) },
  );
}

export async function dispatchVerify(articleId: string, version: string) {
  ensureConfigured();
  return tasks.trigger<typeof verifyArticleTask>(
    "verify-article",
    { articleId },
    { idempotencyKey: await key(`verify:${articleId}:manual:${version}`) },
  );
}

export async function dispatchPublish(articleId: string) {
  ensureConfigured();
  return tasks.trigger<typeof publishApprovedArticle>(
    "publish-approved-article",
    { articleId, mode: "manual" },
    { idempotencyKey: await key(`publish:${articleId}:manual`) },
  );
}
