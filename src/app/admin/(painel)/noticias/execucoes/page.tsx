import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { AGENT_LABELS, Empty, formatDateTimeShort, formatUsd, PageHeading, Panel, StatusBadge } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { reprocessCandidate } from "../actions";

export const metadata: Metadata = { title: "Execuções" };

const TABS = [
  { key: "execucoes", label: "Execuções dos agentes" },
  { key: "candidatos", label: "Candidatos" },
  { key: "auditoria", label: "Auditoria" },
] as const;

function errorMessage(details: unknown) {
  if (details && typeof details === "object" && "message" in details) return String((details as { message: unknown }).message);
  return null;
}

async function Runs() {
  const db = await createSessionClient();
  const { data: runs } = await db
    .from("news_agent_runs")
    .select("id, agent_name, status, started_at, finished_at, model, latency_ms, token_usage, estimated_cost, actual_cost_if_available, error_details, input_reference, run_id")
    .order("started_at", { ascending: false })
    .limit(100);
  if (!runs?.length) return <Empty>Nenhuma execução registrada.</Empty>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-900/8 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-ink-900/8 text-xs uppercase tracking-wider text-ink-900/55">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Início</th>
            <th scope="col" className="px-4 py-3 font-semibold">Agente</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Modelo</th>
            <th scope="col" className="px-4 py-3 font-semibold">Tokens</th>
            <th scope="col" className="px-4 py-3 font-semibold">Custo</th>
            <th scope="col" className="px-4 py-3 font-semibold">Latência</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-900/6">
          {runs.map((run) => {
            const usage = (run.token_usage ?? {}) as { input?: number; output?: number };
            const error = errorMessage(run.error_details);
            return (
              <tr key={run.id} className="align-top">
                <td className="px-4 py-3 text-ink-900/70">{formatDateTimeShort(run.started_at)}</td>
                <td className="px-4 py-3 font-medium">{AGENT_LABELS[run.agent_name] ?? run.agent_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                  {error && <span className="mt-1 block max-w-sm text-xs text-red-700">{error}</span>}
                </td>
                <td className="px-4 py-3 text-ink-900/70">{run.model ?? "—"}</td>
                <td className="px-4 py-3 text-ink-900/70">
                  {usage.input != null ? `${usage.input.toLocaleString("pt-BR")} / ${(usage.output ?? 0).toLocaleString("pt-BR")}` : "—"}
                </td>
                <td className="px-4 py-3 text-ink-900/70">
                  {formatUsd(run.actual_cost_if_available ?? run.estimated_cost)}
                  {run.actual_cost_if_available == null && Number(run.estimated_cost) > 0 && <span className="block text-xs text-ink-900/50">reservado</span>}
                </td>
                <td className="px-4 py-3 text-ink-900/70">{run.latency_ms != null ? `${(run.latency_ms / 1000).toFixed(1)} s` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function Candidates() {
  const db = await createSessionClient();
  const { data: candidates } = await db
    .from("news_candidates")
    .select("id, original_title, original_url, processing_status, relevance_score, relevance_reason, last_error, fetched_at, attempts, source:news_sources(name)")
    .order("fetched_at", { ascending: false })
    .limit(100);
  if (!candidates?.length) return <Empty>Nenhum candidato coletado ainda.</Empty>;

  return (
    <ul className="grid gap-3">
      {candidates.map((candidate) => (
        <li key={candidate.id} className="rounded-2xl border border-ink-900/8 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <a href={candidate.original_url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-900 hover:text-brand-700">
                {candidate.original_title}
              </a>
              <p className="mt-0.5 text-xs text-ink-900/55">
                {candidate.source?.name} · {formatDateTimeShort(candidate.fetched_at)}
                {candidate.relevance_score != null && ` · relevância ${candidate.relevance_score}`}
                {candidate.attempts > 0 && ` · ${candidate.attempts} tentativa(s)`}
              </p>
              {candidate.relevance_reason && <p className="mt-1 text-xs text-ink-900/65">{candidate.relevance_reason}</p>}
              {candidate.last_error && <p className="mt-1 text-xs text-red-700">{candidate.last_error}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusBadge status={candidate.processing_status} />
              {["failed", "dead_letter", "discarded"].includes(candidate.processing_status) && (
                <ActionButton action={reprocessCandidate.bind(null, candidate.id)}>Reprocessar</ActionButton>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Audit() {
  const db = await createSessionClient();
  const { data: logs } = await db
    .from("news_audit_logs")
    .select("id, actor_id, actor_type, action, entity_type, entity_id, timestamp")
    .order("timestamp", { ascending: false })
    .limit(150);
  if (!logs?.length) return <Empty>Sem registros de auditoria.</Empty>;

  return (
    <Panel title="Trilha de auditoria" description="Gravada pelo banco a cada alteração; não pode ser editada.">
      <ul className="divide-y divide-ink-900/6 text-sm">
        {logs.map((log) => (
          <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-ink-900">{log.action}</span>{" "}
              <span className="text-ink-900/60">
                {log.entity_type.replace("news_", "")}
                {log.entity_type === "news_articles" && log.entity_id ? (
                  <>
                    {" "}
                    <Link href={`/admin/noticias/artigos/${log.entity_id}`} className="text-brand-700 hover:text-brand-600">
                      abrir
                    </Link>
                  </>
                ) : null}
              </span>
            </span>
            <span className="text-xs text-ink-900/55">
              {log.actor_type === "user" ? `editor ${log.actor_id?.slice(0, 8) ?? ""}` : log.actor_type} · {formatDateTimeShort(log.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default async function RunsPage({ searchParams }: PageProps<"/admin/noticias/execucoes">) {
  await requireEditor();
  const { aba } = await searchParams;
  const active = TABS.find((tab) => tab.key === aba)?.key ?? "execucoes";

  return (
    <>
      <PageHeading title="Execuções e auditoria" description="Histórico dos agentes, candidatos coletados e trilha de alterações." />
      <nav aria-label="Seções" className="mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/noticias/execucoes?aba=${tab.key}`}
            aria-current={tab.key === active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
              tab.key === active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-900/10 bg-white text-ink-900/75 hover:text-ink-900",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {active === "execucoes" && <Runs />}
      {active === "candidatos" && <Candidates />}
      {active === "auditoria" && <Audit />}
    </>
  );
}
