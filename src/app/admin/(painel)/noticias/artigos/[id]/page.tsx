import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionButton } from "@/components/admin/action-button";
import { ArticleActions } from "@/components/admin/article-actions";
import { ArticleEditor } from "@/components/admin/article-editor";
import { Empty, formatDateTimeShort, Panel, StatusBadge } from "@/components/admin/ui";
import { ArticleBody } from "@/components/tech/article-body";
import { NewsCover } from "@/components/tech/news-cover";
import { requireEditor } from "@/lib/auth/admin";
import { parseOriginalSources, parseSeoMetadata } from "@/lib/news/schemas";
import { createSessionClient } from "@/lib/supabase/server";

import { fetchCoverFromSource, removeCover } from "../../actions";

export const metadata: Metadata = { title: "Revisar artigo" };

export default async function ArticleReviewPage({ params }: PageProps<"/admin/noticias/artigos/[id]">) {
  await requireEditor();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = await createSessionClient();
  const [{ data: article }, { data: categories }, { data: claims }, { data: history }] = await Promise.all([
    db.from("news_articles").select("*, category:news_categories(name, slug), candidate:news_candidates(original_title, relevance_score, relevance_reason)").eq("id", id).maybeSingle(),
    db.from("news_categories").select("id, name").order("sort_order"),
    db.from("news_claims").select("id, claim, status, confidence, checker_notes, evidence:news_claim_evidence(id, source_url, quote, is_independent)").eq("article_id", id).order("created_at"),
    db.from("news_audit_logs").select("id, action, actor_type, timestamp").eq("entity_type", "news_articles").eq("entity_id", id).order("timestamp", { ascending: false }).limit(20),
  ]);
  if (!article) notFound();

  const sources = parseOriginalSources(article.original_sources);
  const seo = parseSeoMetadata(article.seo_metadata);
  const problems = (claims ?? []).filter((claim) => claim.status !== "supported");

  return (
    <>
      <Link href="/admin/noticias/artigos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-900/60 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Artigos
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={article.status} />
        <StatusBadge status={article.verification_status} />
        <StatusBadge status={article.risk_level} />
        {article.status === "published" && (
          <Link href={`/tech/${article.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600">
            Ver no portal <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">{article.title}</h1>
      {article.subtitle && <p className="mt-2 text-lg text-ink-900/70">{article.subtitle}</p>}

      <div className="mt-6 rounded-2xl border border-ink-900/8 bg-white p-5">
        <ArticleActions articleId={article.id} status={article.status} title={article.title} />
      </div>

      {article.review_notes && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h2 className="font-semibold">Notas para revisão</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {article.review_notes.split("\n").filter(Boolean).map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Pré-visualização" description="Como o leitor verá o corpo da notícia">
            <p className="mb-4 text-lg font-medium leading-8 text-ink-900">{article.excerpt}</p>
            <ArticleBody markdown={article.content} />
          </Panel>
          <Panel title="Editar">
            <ArticleEditor
              article={{
                id: article.id,
                title: article.title,
                subtitle: article.subtitle,
                excerpt: article.excerpt,
                content: article.content,
                slug: article.slug,
                categoryId: article.category_id,
                published: article.status === "published",
              }}
              categories={categories ?? []}
            />
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Capa" description={article.cover_image_credit ?? (article.cover_image_url ? undefined : "Sem imagem: o portal usa a capa gerada")}>
            <NewsCover
              categorySlug={article.category?.slug}
              imageUrl={article.cover_image_url}
              imageAlt={article.cover_image_alt}
              size="lg"
              className="aspect-[2/1] rounded-xl"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton action={fetchCoverFromSource.bind(null, article.id)}>
                {article.cover_image_url ? "Buscar de novo na fonte" : "Buscar imagem da fonte"}
              </ActionButton>
              {article.cover_image_url && (
                <ActionButton
                  variant="danger"
                  action={removeCover.bind(null, article.id)}
                  confirm={{ title: "Remover imagem", description: "A notícia passa a usar a capa gerada pelo portal.", confirmLabel: "Remover" }}
                >
                  Remover imagem
                </ActionButton>
              )}
            </div>
          </Panel>

          <Panel
            title="Verificação de fatos"
            description={claims?.length ? `${claims.length} afirmações · ${problems.length} com ressalva` : undefined}
          >
            {(claims ?? []).length === 0 ? (
              <Empty>Ainda sem verificação registrada.</Empty>
            ) : (
              <ol className="grid gap-4">
                {(claims ?? []).map((claim) => (
                  <li key={claim.id} className="rounded-xl border border-ink-900/8 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ink-900">{claim.claim}</p>
                      <StatusBadge status={claim.status} />
                    </div>
                    {claim.checker_notes && <p className="mt-1.5 text-xs text-ink-900/60">{claim.checker_notes}</p>}
                    {claim.evidence.map((evidence) => (
                      <blockquote key={evidence.id} className="mt-2 border-l-2 border-brand-300 pl-3 text-xs text-ink-900/70">
                        “{evidence.quote}”
                        <a href={evidence.source_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center text-brand-700">
                          fonte{evidence.is_independent ? " independente" : ""}
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </blockquote>
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Fontes originais">
            {sources.length === 0 ? (
              <Empty>Sem fontes registradas.</Empty>
            ) : (
              <ul className="grid gap-2 text-sm">
                {sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:text-brand-600">
                      {source.title}
                    </a>
                    <span className="text-ink-900/55"> · {source.publisher}</span>
                  </li>
                ))}
              </ul>
            )}
            {article.candidate && (
              <p className="mt-4 text-xs text-ink-900/60">
                Relevância {article.candidate.relevance_score ?? "—"}/100: {article.candidate.relevance_reason}
              </p>
            )}
          </Panel>

          <Panel title="SEO">
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-xs text-ink-900/55">Meta title</dt><dd>{seo.meta_title ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-900/55">Meta description</dt><dd>{seo.meta_description ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-900/55">Palavras-chave</dt><dd>{seo.keywords?.join(", ") || "—"}</dd></div>
              <div><dt className="text-xs text-ink-900/55">URL</dt><dd className="break-all">/tech/{article.slug}</dd></div>
            </dl>
          </Panel>

          <Panel title="Histórico">
            {(history ?? []).length === 0 ? (
              <Empty>Sem registros.</Empty>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {(history ?? []).map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3">
                    <span>{entry.action}</span>
                    <span className="text-xs text-ink-900/55">
                      {entry.actor_type === "user" ? "editor" : entry.actor_type} · {formatDateTimeShort(entry.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
