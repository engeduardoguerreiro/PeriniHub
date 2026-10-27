import { revalidateTag } from "next/cache";

import { requireSecret } from "@/lib/env";
import { verifyRevalidateRequest } from "@/lib/news/revalidate-signature";

// Chamado pelo worker (Trigger.dev) depois de publicar. Só invalida cache;
// nunca executa o pipeline nem lê dados.
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "corpo grande demais" }, { status: 413 });

  let secret: string;
  try {
    secret = requireSecret("NEWS_REVALIDATE_SECRET");
  } catch {
    return Response.json({ error: "revalidação não configurada" }, { status: 503 });
  }

  const outcome = verifyRevalidateRequest(raw, request.headers.get("x-news-signature"), secret);
  if (!outcome.ok) return Response.json({ error: outcome.reason }, { status: outcome.status });

  const profile = outcome.body.mode === "expire" ? { expire: 0 } : "max";
  for (const tag of outcome.body.tags) revalidateTag(tag, profile);
  return Response.json({ revalidated: outcome.body.tags });
}
