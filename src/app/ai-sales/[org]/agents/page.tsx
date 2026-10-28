import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, Notice, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { AGENT_PRESETS, AGENT_TYPE_LABELS, type AgentType } from "@/features/ai-sales/agents/presets";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { createAgent } from "../agents-actions";

export const metadata: Metadata = { title: "Agentes" };

const STATUS_LABEL: Record<string, string> = { active: "Ativo", testing: "Em teste", inactive: "Inativo" };

async function AgentsContent({ params }: Pick<PageProps<"/ai-sales/[org]/agents">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const db = await createSalesSessionClient();
  const { data: agents } = await db.from("ai_agents").select("id, type, name, status, objective").eq("tenant_id", membership.tenantId).order("created_at");
  const admin = roleAtLeast(membership.role, "admin");
  return (
    <>
      <PageHeading title="Agentes de IA" description="A IA sugere; o sistema só executa o que passa pelas regras (consentimento, janela de 24 h, fontes, limites)." />
      <Notice>
        Agentes novos começam em teste e, sem a chave própria da Anthropic do AI Sales, no modo simulado (sem custo). Todo gasto real passa pelo teto
        mensal de IA da empresa.
      </Notice>
      <div className="mt-6 grid gap-6">
        <Panel title="Agentes da empresa">
          {!agents?.length ? (
            <Empty>Nenhum agente. Crie abaixo.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {agents.map((agent) => (
                <li key={agent.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={orgPath(org, `agents/${agent.id}`)} className="font-medium hover:text-primary hover:underline">
                      {agent.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{AGENT_TYPE_LABELS[agent.type]}</p>
                  </div>
                  <StatusBadge status={agent.status === "active" ? "active" : agent.status === "testing" ? "pending" : "disabled"} label={STATUS_LABEL[agent.status]} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {admin && (
          <Panel title="Criar agente" description="Cada tipo vem com instruções iniciais em português, editáveis.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(AGENT_PRESETS) as AgentType[]).map((type) => (
                <li key={type} className="grid gap-2 rounded-xl border border-border p-4">
                  <p className="font-medium">{AGENT_TYPE_LABELS[type]}</p>
                  <p className="text-sm text-muted-foreground">{AGENT_PRESETS[type].objective}</p>
                  <div>
                    <ActionButton action={createAgent.bind(null, org, type)}>Criar</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

export default function AgentsPage({ params }: PageProps<"/ai-sales/[org]/agents">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AgentsContent params={params} />
    </Suspense>
  );
}
