import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AgentSettingsForm, AgentVersionForm, SdrTestConsole, SupportAgentRunner } from "@/components/ai-sales/agents";
import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, Panel } from "@/components/ai-sales/ui";
import { AGENT_TYPE_LABELS } from "@/features/ai-sales/agents/presets";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { orgPath } from "@/features/ai-sales/paths";
import { requireSecret } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { rollbackAgentVersion } from "../../agents-actions";

export const metadata: Metadata = { title: "Agente" };

function realAvailable() {
  try {
    requireSecret("AI_SALES_ANTHROPIC_API_KEY");
    return true;
  } catch {
    return false;
  }
}

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const DECISION: Record<string, string> = { executed: "executada", rejected: "recusada", needs_approval: "aguarda aprovação" };

async function AgentContent({ params }: Pick<PageProps<"/ai-sales/[org]/agents/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org, "manager");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createSalesSessionClient();
  const { data: agent } = await db.from("ai_agents").select("*").eq("tenant_id", membership.tenantId).eq("id", id).maybeSingle();
  if (!agent) notFound();
  const [{ data: versions }, { data: executions }, { data: numbers }, { data: bases }] = await Promise.all([
    db.from("agent_versions").select("*").eq("tenant_id", membership.tenantId).eq("agent_id", id).order("version", { ascending: false }),
    db.from("agent_executions").select("id, trigger_type, status, is_test, cost_usd, latency_ms, error, started_at, agent_tool_calls(tool, decision, result)").eq("tenant_id", membership.tenantId).eq("agent_id", id).order("started_at", { ascending: false }).limit(20),
    db.from("whatsapp_phone_numbers").select("id, display_phone, account:whatsapp_accounts(provider)").eq("tenant_id", membership.tenantId).neq("status", "disconnected"),
    db.from("knowledge_bases").select("id, name").eq("tenant_id", membership.tenantId).order("name"),
  ]);
  const current = versions?.find((version) => version.id === agent.current_version_id);
  const admin = roleAtLeast(membership.role, "admin");
  const monthCost = (executions ?? []).reduce((total, execution) => total + Number(execution.cost_usd ?? 0), 0);

  return (
    <>
      <Link href={orgPath(org, "agents")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Agentes
      </Link>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{agent.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {AGENT_TYPE_LABELS[agent.type]} · versão {current?.version ?? "—"} · {current?.provider === "mock" ? "simulado" : current?.model}
      </p>
      <div className="grid gap-6">
        {admin ? (
          <Panel title="Configuração">
            <AgentSettingsForm
              slug={org}
              agentId={id}
              values={{ ...agent, handoff_confidence: Number(agent.handoff_confidence) }}
              numbers={(numbers ?? []).map((number) => ({ id: number.id, name: `${number.display_phone}${number.account?.provider === "evolution" ? " (não oficial)" : number.account?.provider === "sandbox" ? " (simulado)" : ""}` }))}
            />
          </Panel>
        ) : (
          <Notice>Só administradores alteram agentes.</Notice>
        )}

        {agent.type === "sdr" && admin && (
          <Panel title="Console de teste" description="Simula uma mensagem de cliente e mostra a proposta do agente. Sempre simulado; nada é enviado.">
            <SdrTestConsole slug={org} agentId={id} />
          </Panel>
        )}
        {(agent.type === "followup" || agent.type === "analyst") && (
          <Panel title="Executar" description={agent.type === "followup" ? "Lista negociações paradas há mais de 7 dias com o próximo passo sugerido. Nada é enviado." : "Resumo dos indicadores dos últimos 30 dias."}>
            <SupportAgentRunner slug={org} agentId={id} active={agent.status === "active"} />
          </Panel>
        )}
        {agent.type === "capture" && <Notice>Este agente roda na ficha do lead (botão “Classificar com IA”), quando ativo.</Notice>}

        {admin && current && (
          <Panel title="Instruções e modelo" description="Cada alteração vira uma nova versão.">
            <AgentVersionForm slug={org} agentId={id} values={{ ...current, input_price_per_mtok: Number(current.input_price_per_mtok), output_price_per_mtok: Number(current.output_price_per_mtok) }} bases={bases ?? []} realAvailable={realAvailable()} />
          </Panel>
        )}

        <Panel title="Versões">
          <ul className="divide-y divide-border text-sm">
            {(versions ?? []).map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  v{version.version} · {version.provider === "mock" ? "simulado" : version.model} · {formatDateTime(version.created_at)}
                  {version.notes && <span className="text-muted-foreground"> · {version.notes}</span>}
                </span>
                {version.id === agent.current_version_id ? (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">em uso</span>
                ) : (
                  admin && <ActionButton action={rollbackAgentVersion.bind(null, org, id, version.id)}>Usar esta</ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Execuções recentes" description={`Custo das últimas 20: ${usd.format(monthCost)}.`}>
          {!executions?.length ? (
            <Empty>Nenhuma execução.</Empty>
          ) : (
            <ol className="grid gap-2 text-sm">
              {executions.map((execution) => (
                <li key={execution.id} className="rounded-lg border border-border px-3 py-2">
                  <p>
                    <span className="font-medium">{execution.status === "succeeded" ? "Concluída" : execution.status === "failed" ? "Falhou" : execution.status === "skipped" ? "Não executada" : "Em andamento"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {execution.is_test ? "teste" : execution.trigger_type} · {formatDateTime(execution.started_at)} · {usd.format(Number(execution.cost_usd ?? 0))}
                      {execution.latency_ms ? ` · ${(execution.latency_ms / 1000).toFixed(1)} s` : ""}
                    </span>
                  </p>
                  {execution.error && <p className="text-xs text-red-700 dark:text-red-300">{execution.error}</p>}
                  {execution.agent_tool_calls.map((call, index) => (
                    <p key={index} className="text-xs text-muted-foreground">
                      {call.tool}: {DECISION[call.decision]} — {call.result}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function AgentPage({ params }: PageProps<"/ai-sales/[org]/agents/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AgentContent params={params} />
    </Suspense>
  );
}
