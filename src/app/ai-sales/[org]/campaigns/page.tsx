import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { CampaignForm, FollowupRuleForm } from "@/components/ai-sales/campaigns";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { CAMPAIGN_STATUS } from "@/features/ai-sales/campaigns/labels";
import { loadSendOptions } from "@/features/ai-sales/campaigns/options";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { runFollowupsNow, setFollowupRuleActive } from "../campaigns-actions";

export const metadata: Metadata = { title: "Campanhas" };


async function CampaignsContent({ params }: Pick<PageProps<"/ai-sales/[org]/campaigns">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  if (!roleAtLeast(membership.role, "manager")) return <Notice>Campanhas e follow-up são geridos por gestores, administradores e proprietários.</Notice>;
  const db = await createSalesSessionClient();
  const [{ data: campaigns }, { data: rules }, options, crm] = await Promise.all([
    db.from("campaigns").select("id, name, status, eligible_count, created_at").eq("tenant_id", membership.tenantId).order("created_at", { ascending: false }),
    db.from("followup_rules").select("id, name, active, idle_days, max_attempts, min_interval_days").eq("tenant_id", membership.tenantId).order("created_at"),
    loadSendOptions(membership.tenantId),
    loadCrmOptions(membership.tenantId),
  ]);
  const stages = crm.stages.filter((stage) => !stage.is_won && !stage.is_lost).map((stage) => ({ id: stage.id, name: stage.name }));

  return (
    <>
      <PageHeading title="Campanhas" description="Envio só com aprovação, para contatos com consentimento e fora da supressão, em lotes dentro da janela de horário." />
      <div className="grid gap-6">
        <Panel title="Campanhas">
          {!campaigns?.length ? (
            <Empty>Nenhuma campanha.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link href={orgPath(org, `campaigns/${campaign.id}`)} className="font-medium hover:text-primary hover:underline">
                      {campaign.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {campaign.eligible_count} elegível(is) · criada em {formatDateTime(campaign.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={CAMPAIGN_STATUS[campaign.status].tone} label={CAMPAIGN_STATUS[campaign.status].label} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Nova campanha" description="Começa como rascunho. Depois: montar público → enviar para aprovação → aprovar → iniciar.">
          <CampaignForm slug={org} {...options} stages={stages} sources={crm.sources.filter((source) => source.active)} tags={crm.tags} />
        </Panel>
        <Panel title="Follow-up automático" description="Retoma leads parados na etapa. Cada envio passa pelo gate (consentimento, supressão, 2 por semana por contato). Roda em dias úteis, 9h–18h.">
          {rules?.length ? (
            <ul className="mb-4 divide-y divide-border text-sm">
              {rules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {rule.name}{" "}
                    <span className="text-muted-foreground">
                      · parado há {rule.idle_days} dia(s) · até {rule.max_attempts} tentativa(s), a cada {rule.min_interval_days} dia(s)
                    </span>
                  </span>
                  <ActionButton action={setFollowupRuleActive.bind(null, org, rule.id, !rule.active)}>{rule.active ? "Desativar" : "Ativar"}</ActionButton>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-4">
              <Empty>Nenhuma regra.</Empty>
            </div>
          )}
          <div className="mb-6">
            <ActionButton action={runFollowupsNow.bind(null, org)}>Rodar regras ativas agora</ActionButton>
          </div>
          <FollowupRuleForm slug={org} {...options} stages={stages} />
        </Panel>
      </div>
    </>
  );
}

export default function CampaignsPage({ params }: PageProps<"/ai-sales/[org]/campaigns">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CampaignsContent params={params} />
    </Suspense>
  );
}
