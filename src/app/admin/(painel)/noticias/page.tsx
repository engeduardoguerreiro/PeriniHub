import type { Metadata } from "next";
import { AlertTriangle, CircleDollarSign, Coins, FileCheck2, Inbox, Newspaper, Pause, Play, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { ActionButton } from "@/components/admin/action-button";
import { AGENT_LABELS, Empty, formatDateTimeShort, formatUsd, PageHeading, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";

import { runResearchNow, setAutomationPaused } from "./actions";

export const metadata: Metadata = { title: "Visão geral" };

const statsSchema = z.object({
  candidates_total: z.number(),
  candidates_today: z.number(),
  candidates_eligible: z.number(),
  articles_pending: z.number(),
  articles_approved: z.number(),
  published_today: z.number(),
  published_total: z.number(),
  cost_today: z.coerce.number(),
  cost_month: z.coerce.number(),
  tokens_month: z.coerce.number(),
  failures_by_agent: z.record(z.string(), z.number()),
  last_run: z
    .object({ agent_name: z.string(), status: z.string(), started_at: z.string(), finished_at: z.string().nullable() })
    .nullable(),
});


export default async function DashboardPage() {
  const user = await requireEditor();
  const db = await createSessionClient();

  const [statsRes, settingsRes, sourcesRes, auditRes, reviewRes, reportRes] = await Promise.all([
    db.rpc("news_dashboard_stats"),
    db.from("news_editorial_settings").select("*").eq("id", 1).single(),
    db
      .from("news_sources")
      .select("id, name, enabled, last_status, last_error, last_fetched_at, consecutive_failures")
      .order("consecutive_failures", { ascending: false })
      .order("name"),
    db
      .from("news_audit_logs")
      .select("id, actor_type, action, entity_type, entity_id, timestamp")
      .order("timestamp", { ascending: false })
      .limit(10),
    db
      .from("news_articles")
      .select("id, title, status, risk_level, updated_at")
      .in("status", ["needs_review", "blocked", "approved", "scheduled"])
      .order("updated_at", { ascending: false })
      .limit(6),
    db
      .from("news_agent_runs")
      .select("output_reference, started_at")
      .eq("agent_name", "pipeline")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = statsSchema.safeParse(statsRes.data);
  const settings = settingsRes.data;
  const sources = sourcesRes.data ?? [];
  const unhealthy = sources.filter((source) => source.enabled && source.consecutive_failures > 0);
  const budgetUsed = stats.success && settings ? stats.data.cost_month / Math.max(Number(settings.monthly_cost_limit), 0.01) : 0;

  return (
    <>
      <PageHeading
        title="PeriniHub Tech"
        description="Acompanhe a coleta, a produção e a publicação das notícias."
        actions={
          <>
            <ActionButton variant="primary" action={runResearchNow} disabled={settings?.automation_paused}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Executar pesquisa agora
            </ActionButton>
            {user.role === "admin" && settings && (
              <ActionButton
                variant={settings.automation_paused ? "dark" : "danger"}
                action={setAutomationPaused.bind(null, !settings.automation_paused)}
                confirm={
                  settings.automation_paused
                    ? undefined
                    : {
                        title: "Pausar automações",
                        description:
                          "Coletas, redação, verificação e publicações automáticas param até você retomar. Artigos já publicados continuam no ar.",
                        confirmLabel: "Pausar",
                      }
                }
              >
                {settings.automation_paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                {settings.automation_paused ? "Retomar automações" : "Pausar automações"}
              </ActionButton>
            )}
          </>
        }
      />

      {settings?.automation_paused && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <Pause className="h-4 w-4" aria-hidden="true" /> Automações pausadas. Nada é coletado, redigido ou publicado automaticamente.
        </p>
      )}

      {!stats.success ? (
        <Empty>Não foi possível carregar as métricas.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Notícias coletadas" value={stats.data.candidates_total} hint={`${stats.data.candidates_today} hoje`} icon={Inbox} />
          <StatCard label="Elegíveis" value={stats.data.candidates_eligible} hint="aguardando redação" icon={Sparkles} />
          <StatCard
            label="Pendentes de revisão"
            value={stats.data.articles_pending}
            hint={`${stats.data.articles_approved} aprovados/agendados`}
            icon={FileCheck2}
            tone={stats.data.articles_pending > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Publicadas hoje"
            value={`${stats.data.published_today}/${settings?.daily_publication_limit ?? "—"}`}
            hint={`${stats.data.published_total} no total`}
            icon={Newspaper}
          />
          <StatCard label="Custo hoje" value={formatUsd(stats.data.cost_today)} icon={CircleDollarSign} />
          <StatCard
            label="Custo no mês"
            value={formatUsd(stats.data.cost_month)}
            hint={`${Math.round(budgetUsed * 100)}% do teto de ${formatUsd(settings?.monthly_cost_limit)}`}
            icon={CircleDollarSign}
            tone={budgetUsed >= 0.9 ? "danger" : budgetUsed >= 0.7 ? "warning" : "default"}
          />
          <StatCard label="Tokens no mês" value={stats.data.tokens_month.toLocaleString("pt-BR")} icon={Coins} />
          <StatCard
            label="Última execução"
            value={stats.data.last_run ? (AGENT_LABELS[stats.data.last_run.agent_name] ?? stats.data.last_run.agent_name) : "—"}
            hint={stats.data.last_run ? `${formatDateTimeShort(stats.data.last_run.started_at)} · ${stats.data.last_run.status}` : "nenhuma ainda"}
            icon={AlertTriangle}
            tone={stats.data.last_run?.status === "failed" ? "danger" : "default"}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Fila editorial"
          actions={
            <Link href="/admin/noticias/artigos" className="text-sm font-medium text-brand-700 hover:text-brand-600">
              Ver todos
            </Link>
          }
        >
          {(reviewRes.data ?? []).length === 0 ? (
            <Empty>Nenhum artigo aguardando ação.</Empty>
          ) : (
            <ul className="divide-y divide-ink-900/8">
              {(reviewRes.data ?? []).map((article) => (
                <li key={article.id} className="flex items-center justify-between gap-3 py-3">
                  <Link
                    href={`/admin/noticias/artigos/${article.id}`}
                    className="min-w-0 truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {article.title}
                  </Link>
                  <span className="flex shrink-0 gap-1.5">
                    {article.risk_level === "high" && <StatusBadge status="high" />}
                    <StatusBadge status={article.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Falhas por agente" description="Últimos 7 dias">
          {stats.success && Object.keys(stats.data.failures_by_agent).length > 0 ? (
            <ul className="grid gap-2">
              {Object.entries(stats.data.failures_by_agent).map(([agent, count]) => (
                <li key={agent} className="flex items-center justify-between text-sm">
                  <span>{AGENT_LABELS[agent] ?? agent}</span>
                  <span className="font-semibold text-red-700">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhuma falha registrada.</Empty>
          )}
          <Link href="/admin/noticias/execucoes" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-600">
            Ver histórico de execuções
          </Link>
        </Panel>

        <Panel
          title="Saúde das fontes"
          description={`${sources.filter((s) => s.enabled).length} ativas · ${unhealthy.length} com falha recente`}
        >
          {unhealthy.length === 0 ? (
            <Empty>Todas as fontes ativas responderam na última coleta.</Empty>
          ) : (
            <ul className="divide-y divide-ink-900/8">
              {unhealthy.map((source) => (
                <li key={source.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink-900">{source.name}</span>
                    <span className="text-xs text-red-700">{source.consecutive_failures} falha(s) seguidas</span>
                  </div>
                  {source.last_error && <p className="mt-1 truncate text-xs text-ink-900/55">{source.last_error}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Histórico editorial" description="Últimas alterações (auditoria)">
          {(auditRes.data ?? []).length === 0 ? (
            <Empty>Sem registros.</Empty>
          ) : (
            <ul className="divide-y divide-ink-900/8">
              {(auditRes.data ?? []).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink-900">{log.action}</span>{" "}
                    <span className="text-ink-900/55">em {log.entity_type.replace("news_", "")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-900/55">
                    {log.actor_type === "user" ? "editor" : log.actor_type} · {formatDateTimeShort(log.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {reportRes.data?.output_reference && (
        <Panel title="Relatório diário mais recente" description={formatDateTimeShort(reportRes.data.started_at)} className="mt-6">
          <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-5 text-white/85">
            {JSON.stringify(reportRes.data.output_reference, null, 2)}
          </pre>
        </Panel>
      )}
    </>
  );
}
