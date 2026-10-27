import type { Metadata } from "next";
import Link from "next/link";

import { Empty, formatDateTimeShort, PageHeading, StatusBadge } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Artigos" };

const FILTERS = [
  { key: "fila", label: "Fila editorial", statuses: ["needs_review", "blocked", "draft"] },
  { key: "aprovados", label: "Aprovados e agendados", statuses: ["approved", "scheduled"] },
  { key: "publicados", label: "Publicados", statuses: ["published"] },
  { key: "encerrados", label: "Rejeitados e arquivados", statuses: ["rejected", "archived"] },
] as const;

export default async function ArticlesPage({ searchParams }: PageProps<"/admin/noticias/artigos">) {
  await requireEditor();
  const { filtro } = await searchParams;
  const active = FILTERS.find((filter) => filter.key === filtro) ?? FILTERS[0];

  const db = await createSessionClient();
  const { data: articles, error } = await db
    .from("news_articles")
    .select("id, title, status, verification_status, risk_level, updated_at, published_at, scheduled_for, category:news_categories(name)")
    .in("status", [...active.statuses])
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeading title="Artigos" description="Revise, aprove, agende e publique as notícias produzidas pelos agentes." />
      <nav aria-label="Filtrar artigos" className="mb-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={`/admin/noticias/artigos?filtro=${filter.key}`}
            aria-current={filter.key === active.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              filter.key === active.key ? "border-ink-900 bg-ink-900 text-white" : "border-ink-900/10 bg-white text-ink-900/75 hover:text-ink-900",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <Empty>Não foi possível carregar os artigos.</Empty>
      ) : articles.length === 0 ? (
        <Empty>Nenhum artigo nesta lista.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-900/8 text-xs uppercase tracking-wider text-ink-900/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Título</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Verificação</th>
                <th scope="col" className="px-4 py-3 font-semibold">Categoria</th>
                <th scope="col" className="px-4 py-3 font-semibold">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/6">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-brand-50/40">
                  <td className="max-w-md px-4 py-3">
                    <Link href={`/admin/noticias/artigos/${article.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {article.title}
                    </Link>
                    {article.risk_level === "high" && (
                      <span className="ml-2 align-middle">
                        <StatusBadge status="high" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                    {article.status === "scheduled" && (
                      <span className="mt-1 block text-xs text-ink-900/55">{formatDateTimeShort(article.scheduled_for)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={article.verification_status} /></td>
                  <td className="px-4 py-3 text-ink-900/70">{article.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-900/60">{formatDateTimeShort(article.published_at ?? article.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
