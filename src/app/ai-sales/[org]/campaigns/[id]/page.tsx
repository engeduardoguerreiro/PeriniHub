import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, Panel, StatCard, StatusBadge } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { CAMPAIGN_STATUS, ESTIMATED_COST_BRL, RECIPIENT_STATUS } from "@/features/ai-sales/campaigns/labels";
import { PURPOSE_LABELS } from "@/features/ai-sales/crm/labels";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { buildAudience, dispatchNow, transitionCampaign } from "../../campaigns-actions";

export const metadata: Metadata = { title: "Campanha" };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function CampaignContent({ params }: Pick<PageProps<"/ai-sales/[org]/campaigns/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org, "manager");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createSalesSessionClient();
  const { data: campaign } = await db
    .from("campaigns")
    .select("*, template:whatsapp_templates(name, category), number:whatsapp_phone_numbers(display_phone)")
    .eq("tenant_id", membership.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();
  const [{ data: recipients }, { data: runs }, { data: statusRows }] = await Promise.all([
    db.from("campaign_recipients").select("id, eligibility, exclusion_reason, status, detail, processed_at, contact:contacts(full_name)").eq("tenant_id", membership.tenantId).eq("campaign_id", id).order("eligibility").limit(200),
    db.from("campaign_runs").select("id, planned, sent, blocked, failed, stopped_reason, started_at").eq("tenant_id", membership.tenantId).eq("campaign_id", id).order("started_at", { ascending: false }).limit(10),
    db.from("campaign_recipients").select("status").eq("tenant_id", membership.tenantId).eq("campaign_id", id).eq("eligibility", "eligible"),
  ]);
  const counts = (statusRows ?? []).reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  const status = CAMPAIGN_STATUS[campaign.status];
  const unit = ESTIMATED_COST_BRL[campaign.template?.category ?? "marketing"] ?? 0.4;
  const estimate = Math.min(campaign.eligible_count, campaign.total_limit) * unit;
  const mine = campaign.created_by === membership.user.id;
  const reasons = (recipients ?? []).filter((recipient) => recipient.eligibility === "excluded").reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.exclusion_reason ?? "outro"]: (acc[item.exclusion_reason ?? "outro"] ?? 0) + 1 }), {});

  return (
    <>
      <Link href={orgPath(org, "campaigns")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Campanhas
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{campaign.name}</h1>
        <StatusBadge status={status.tone} label={status.label} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Template {campaign.template?.name} ({campaign.template?.category}) · {campaign.number?.display_phone} · finalidade {PURPOSE_LABELS[campaign.purpose]} · janela{" "}
        {campaign.window_start.slice(0, 5)}–{campaign.window_end.slice(0, 5)} · até {campaign.hourly_limit}/hora, {campaign.daily_limit}/dia, {campaign.total_limit} no total
      </p>
      {campaign.status_reason && <div className="mb-6"><Notice tone="warning">Motivo registrado: {campaign.status_reason}{campaign.emergency_stopped_at && ` (pausa de emergência em ${formatDateTime(campaign.emergency_stopped_at)})`}</Notice></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Elegíveis" value={campaign.eligible_count} hint={campaign.audience_built_at ? `Público montado em ${formatDateTime(campaign.audience_built_at)}` : "Público ainda não montado"} />
        <StatCard label="Excluídos" value={campaign.excluded_count} hint={Object.entries(reasons).map(([reason, count]) => `${count} ${reason}`).join(" · ") || undefined} />
        <StatCard label="Enviadas" value={counts.sent ?? 0} hint={`${counts.blocked ?? 0} bloqueada(s) pelo gate · ${counts.failed ?? 0} falha(s) · ${counts.pending ?? 0} na fila`} />
        <StatCard label="Custo estimado" value={brl.format(estimate)} hint={`~${brl.format(unit)} por mensagem (referência; conferir na Meta)`} />
      </div>

      <Panel title="Ações" className="mt-6" description="Cada passo fica registrado na auditoria. Pausa vale imediatamente, inclusive no meio de um lote.">
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <>
              <ActionButton action={buildAudience.bind(null, org, id)}>{campaign.audience_built_at ? "Remontar público" : "Montar público"}</ActionButton>
              <ActionButton variant="primary" action={transitionCampaign.bind(null, org, id, "awaiting_approval", false)}>
                Enviar para aprovação
              </ActionButton>
            </>
          )}
          {campaign.status === "awaiting_approval" && (
            <>
              <ActionButton
                variant="primary"
                action={transitionCampaign.bind(null, org, id, "scheduled", false)}
                confirm={{ title: "Aprovar campanha?", description: `Até ${Math.min(campaign.eligible_count, campaign.total_limit)} mensagens, custo estimado ${brl.format(estimate)}. Cada envio ainda passa pelo gate.`, confirmLabel: "Aprovar" }}
              >
                Aprovar{mine ? " (você criou)" : ""}
              </ActionButton>
              <ActionButton action={transitionCampaign.bind(null, org, id, "draft", false)}>Voltar para rascunho</ActionButton>
            </>
          )}
          {(campaign.status === "scheduled" || campaign.status === "running") && (
            <>
              <ActionButton variant="primary" action={dispatchNow.bind(null, org, id)}>
                Enviar próximo lote agora
              </ActionButton>
              <ActionButton action={transitionCampaign.bind(null, org, id, "paused", false)} confirm={{ title: "Pausar campanha?", description: "Novos envios param; dá para retomar.", confirmLabel: "Pausar", reason: true }}>
                Pausar
              </ActionButton>
              <ActionButton
                variant="danger"
                action={transitionCampaign.bind(null, org, id, "paused", true)}
                confirm={{ title: "Pausa de emergência?", description: "Para tudo na hora. Retomar exigirá cancelar e criar outra campanha com nova aprovação.", confirmLabel: "Parar agora", reason: true }}
              >
                Pausa de emergência
              </ActionButton>
            </>
          )}
          {campaign.status === "paused" && !campaign.emergency_stopped_at && <ActionButton action={transitionCampaign.bind(null, org, id, "running", false)}>Retomar</ActionButton>}
          {!["completed", "canceled"].includes(campaign.status) && (
            <ActionButton variant="danger" action={transitionCampaign.bind(null, org, id, "canceled", false)} confirm={{ title: "Cancelar campanha?", description: "Quem ainda não recebeu não receberá. Não dá para desfazer.", confirmLabel: "Cancelar campanha", reason: true }}>
              Cancelar
            </ActionButton>
          )}
        </div>
        {campaign.status === "scheduled" && <p className="mt-3 text-xs text-muted-foreground">Agendada: o worker envia um lote a cada 10 minutos dentro da janela. O botão acima envia um lote agora.</p>}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Destinatários" description="Até 200, elegíveis primeiro.">
          {!recipients?.length ? (
            <Empty>Público ainda não montado.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recipients.map((recipient) => (
                <li key={recipient.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{recipient.contact?.full_name ?? "Contato"}</span>
                  <span className="text-xs text-muted-foreground">
                    {recipient.eligibility === "excluded" ? `excluído: ${recipient.exclusion_reason}` : RECIPIENT_STATUS[recipient.status]}
                    {recipient.detail && ` · ${recipient.detail}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Lotes">
          {!runs?.length ? (
            <Empty>Nenhum lote.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {runs.map((run) => (
                <li key={run.id} className="py-2">
                  <p>{formatDateTime(run.started_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.sent}/{run.planned} enviadas · {run.blocked} bloqueadas · {run.failed} falhas{run.stopped_reason && ` · ${run.stopped_reason}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function CampaignPage({ params }: PageProps<"/ai-sales/[org]/campaigns/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CampaignContent params={params} />
    </Suspense>
  );
}
