import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { SourceForm } from "@/components/admin/forms";
import { Empty, formatDateTimeShort, PageHeading, Panel, StatusBadge } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";

import { setSourceEnabled } from "../actions";

export const metadata: Metadata = { title: "Fontes" };

const TRUST_LABELS: Record<string, string> = { official: "Oficial", high: "Alta", medium: "Média", low: "Baixa" };

export default async function SourcesPage() {
  const user = await requireEditor();
  const isAdmin = user.role === "admin";
  const db = await createSessionClient();
  const [{ data: sources }, { data: categories }] = await Promise.all([
    db.from("news_sources").select("*, category:news_categories(name)").order("name"),
    db.from("news_categories").select("id, name").eq("enabled", true).order("sort_order"),
  ]);

  return (
    <>
      <PageHeading title="Fontes monitoradas" description="Feeds RSS/Atom oficiais lidos pelo agente Researcher. Sem scraping de páginas." />

      {isAdmin && (
        <Panel title="Nova fonte" className="mb-6">
          <SourceForm categories={categories ?? []} />
        </Panel>
      )}

      {(sources ?? []).length === 0 ? (
        <Empty>Nenhuma fonte cadastrada.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-900/8 text-xs uppercase tracking-wider text-ink-900/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Fonte</th>
                <th scope="col" className="px-4 py-3 font-semibold">Categoria</th>
                <th scope="col" className="px-4 py-3 font-semibold">Confiabilidade</th>
                <th scope="col" className="px-4 py-3 font-semibold">Última coleta</th>
                <th scope="col" className="px-4 py-3 font-semibold">Saúde</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/6">
              {(sources ?? []).map((source) => (
                <tr key={source.id} className={source.enabled ? undefined : "opacity-60"}>
                  <td className="px-4 py-3">
                    <a href={source.website_url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-900 hover:text-brand-700">
                      {source.name}
                    </a>
                    <span className="block max-w-xs truncate text-xs text-ink-900/50">{source.feed_url}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-900/70">{source.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-900/70">{TRUST_LABELS[source.trust_level]}</td>
                  <td className="px-4 py-3 text-ink-900/60">{formatDateTimeShort(source.last_fetched_at)}</td>
                  <td className="px-4 py-3">
                    {source.last_status ? <StatusBadge status={source.last_status} /> : <span className="text-ink-900/50">—</span>}
                    {source.consecutive_failures > 0 && (
                      <span className="mt-1 block max-w-xs truncate text-xs text-red-700" title={source.last_error ?? undefined}>
                        {source.consecutive_failures} falha(s): {source.last_error}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && (
                      <ActionButton action={setSourceEnabled.bind(null, source.id, !source.enabled)}>
                        {source.enabled ? "Desativar" : "Ativar"}
                      </ActionButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
