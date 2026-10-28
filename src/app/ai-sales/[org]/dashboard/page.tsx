import type { Metadata } from "next";
import { AlarmClock, BadgeCheck, Briefcase, ShieldCheck, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, PageHeading, Panel, StatCard } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { formatCents } from "@/features/ai-sales/crm/labels";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// Indicadores calculados no banco (crm_dashboard) com o RLS do usuário:
// vendedor com visibilidade "atribuídos" vê só os números dos seus leads.
// Definições em docs/ai-sales/ARCHITECTURE.md §7. Sem dados → "—".

const PERIODS = { "7": "7 dias", "30": "30 dias", "90": "90 dias" } as const;
type Period = keyof typeof PERIODS;

type Metrics = {
  leads_created: number;
  leads_by_source: { source: string; count: number }[];
  leads_authorized: number;
  leads_qualified: number;
  opportunities_open: number;
  opportunities_won: number;
  opportunities_lost: number;
  won_amount_cents: number;
  tasks_overdue: number;
};

const MODULES = [
  { name: "Agentes de IA e base de conhecimento", phase: 4 },
  { name: "Campanhas e follow-up", phase: 5 },
  { name: "Captação e enriquecimento", phase: 6 },
];

// Página dinâmica (por requisição): usar o relógio aqui é seguro.
function periodRange(period: Period) {
  const to = new Date();
  const from = new Date(to.getTime() - Number(period) * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function DashboardContent({ params, searchParams }: PageProps<"/ai-sales/[org]/dashboard">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const period: Period = typeof query.periodo === "string" && query.periodo in PERIODS ? (query.periodo as Period) : "30";
  const { from, to } = periodRange(period);
  const db = await createSalesSessionClient();
  const [{ data }, { data: myTasks }] = await Promise.all([
    db.rpc("crm_dashboard", { p_tenant: membership.tenantId, p_from: from, p_to: to }),
    db
      .from("tasks")
      .select("id, title, due_at, lead_id")
      .eq("tenant_id", membership.tenantId)
      .eq("assignee_user_id", membership.user.id)
      .eq("status", "open")
      .order("due_at", { nullsFirst: false })
      .limit(8),
  ]);
  const metrics = data as Metrics | null;
  const closed = (metrics?.opportunities_won ?? 0) + (metrics?.opportunities_lost ?? 0);
  const conversion = closed > 0 ? `${Math.round(((metrics?.opportunities_won ?? 0) / closed) * 100)}%` : "—";
  const maxSource = Math.max(1, ...(metrics?.leads_by_source ?? []).map((item) => item.count));
  const base = orgPath(org, "dashboard");

  return (
    <>
      <PageHeading
        title={membership.name}
        description="Visão comercial do período. Números calculados a partir dos dados cadastrados."
        actions={
          <nav aria-label="Período" className="inline-flex rounded-full border border-border bg-card p-0.5">
            {Object.entries(PERIODS).map(([value, label]) => (
              <Link
                key={value}
                href={`${base}?periodo=${value}`}
                aria-current={period === value ? "page" : undefined}
                className={cn("rounded-full px-3 py-1.5 text-sm font-medium", period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </Link>
            ))}
          </nav>
        }
      />
      {!metrics ? (
        <Empty>Não foi possível calcular os indicadores agora.</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Leads cadastrados" value={metrics.leads_created} hint={`Criados nos últimos ${PERIODS[period]}.`} icon={UserPlus} />
            <StatCard label="Leads qualificados" value={metrics.leads_qualified} hint="Entraram em etapa marcada como qualificada no período." icon={BadgeCheck} />
            <StatCard label="Autorizados para WhatsApp" value={metrics.leads_authorized} hint="Consentimento vigente e fora da supressão (situação atual)." icon={ShieldCheck} />
            <StatCard label="Oportunidades abertas" value={metrics.opportunities_open} icon={Briefcase} />
            <StatCard
              label="Taxa de conversão"
              value={conversion}
              hint={closed ? `${metrics.opportunities_won} ganha(s) de ${closed} fechada(s) · ${formatCents(metrics.won_amount_cents)}` : "Nenhuma oportunidade fechada no período."}
              icon={Trophy}
            />
            <StatCard label="Tarefas atrasadas" value={metrics.tasks_overdue} icon={AlarmClock} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Leads por origem" description={`Últimos ${PERIODS[period]}.`}>
              {metrics.leads_by_source.length ? (
                <ul className="grid gap-3 text-sm">
                  {metrics.leads_by_source.map((item) => (
                    <li key={item.source} className="grid gap-1">
                      <div className="flex justify-between gap-2">
                        <span>{item.source}</span>
                        <span className="font-medium tabular-nums">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(item.count / maxSource) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhum lead no período.</Empty>
              )}
            </Panel>
            <Panel title="Minhas tarefas abertas">
              {myTasks?.length ? (
                <ul className="divide-y divide-border text-sm">
                  {myTasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap justify-between gap-2 py-2">
                      {task.lead_id ? (
                        <Link href={orgPath(org, `leads/${task.lead_id}`)} className="font-medium hover:text-primary hover:underline">
                          {task.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{task.title}</span>
                      )}
                      <span className="text-muted-foreground">{task.due_at ? formatDateTime(task.due_at) : "sem prazo"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhuma tarefa aberta para você.</Empty>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel title="Próximos módulos" className="mt-6" description="Conversas, custos de IA e de WhatsApp entram nos indicadores quando os módulos existirem.">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {MODULES.map((module) => (
            <li key={module.name} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span>{module.name}</span>
              <span className="text-xs text-muted-foreground">Fase {module.phase} · não configurado</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

export default function DashboardPage(props: PageProps<"/ai-sales/[org]/dashboard">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
