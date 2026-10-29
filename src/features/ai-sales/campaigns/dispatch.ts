import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { sendWhatsApp } from "../whatsapp/send";
import { inSendWindow, renderParameters } from "./params";

// Despacho de campanhas e follow-up. Roda no worker (Trigger.dev) ou pelo
// botão "enviar próximo lote" — sempre em lotes pequenos, dentro da janela
// de horário e dos limites por hora/dia/total. Cada envio passa pelo gate do
// banco na hora (consentimento, supressão, frequência), e o status da
// campanha é relido antes de cada mensagem: pausa vale imediatamente.

const MAX_BATCH = 20;

export type BatchResult = { status: "sent" | "idle" | "stopped" | "outside_window" | "limit_reached" | "completed"; sent: number; blocked: number; failed: number; reason?: string };

async function campaignStatus(campaignId: string) {
  const { data } = await createSalesServiceClient().from("campaigns").select("status, emergency_stopped_at").eq("id", campaignId).single();
  return data;
}

export async function dispatchCampaignBatch(tenantId: string, campaignId: string, now = Date.now()): Promise<BatchResult> {
  const db = createSalesServiceClient();
  let { data: campaign } = await db.from("campaigns").select("*").eq("tenant_id", tenantId).eq("id", campaignId).single();
  if (!campaign) return { status: "stopped", sent: 0, blocked: 0, failed: 0, reason: "Campanha não encontrada." };

  if (campaign.status === "scheduled" && (!campaign.starts_at || new Date(campaign.starts_at).getTime() <= now)) {
    const started = await db.rpc("campaign_transition", { p_tenant: tenantId, p_campaign: campaignId, p_to: "running" });
    if (started.error) return { status: "stopped", sent: 0, blocked: 0, failed: 0, reason: started.error.message };
    campaign = started.data;
  }
  if (campaign.status !== "running" || campaign.emergency_stopped_at) return { status: "stopped", sent: 0, blocked: 0, failed: 0, reason: `Campanha ${campaign.status}.` };

  const { data: settings } = await db.from("organization_settings").select("timezone").eq("tenant_id", tenantId).single();
  if (!inSendWindow(campaign.window_start, campaign.window_end, settings?.timezone ?? "America/Sao_Paulo", now)) {
    return { status: "outside_window", sent: 0, blocked: 0, failed: 0, reason: "Fora da janela de horário da campanha." };
  }

  const sentSince = async (ms: number) =>
    (await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "sent").gt("processed_at", new Date(now - ms).toISOString())).count ?? 0;
  const [lastHour, lastDay, { count: total }] = await Promise.all([
    sentSince(3_600_000),
    sentSince(86_400_000),
    db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "sent"),
  ]);
  const allowance = Math.min(MAX_BATCH, campaign.hourly_limit - lastHour, campaign.daily_limit - lastDay, campaign.total_limit - (total ?? 0));
  if (allowance <= 0) {
    if ((total ?? 0) >= campaign.total_limit) await db.rpc("campaign_transition", { p_tenant: tenantId, p_campaign: campaignId, p_to: "completed" });
    return { status: "limit_reached", sent: 0, blocked: 0, failed: 0, reason: "Limite de envio da campanha atingido nesta janela." };
  }

  const { data: claimed } = await db.rpc("campaign_claim_recipients", { p_campaign: campaignId, p_limit: allowance });
  const recipients = claimed ?? [];
  if (!recipients.length) {
    const { count: open } = await db.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("eligibility", "eligible").in("status", ["pending", "processing"]);
    if (!open) {
      await db.rpc("campaign_transition", { p_tenant: tenantId, p_campaign: campaignId, p_to: "completed" });
      return { status: "completed", sent: 0, blocked: 0, failed: 0 };
    }
    return { status: "idle", sent: 0, blocked: 0, failed: 0 };
  }

  const { data: run } = await db.from("campaign_runs").insert({ tenant_id: tenantId, campaign_id: campaignId, planned: recipients.length }).select("id").single();
  const counts = { sent: 0, blocked: 0, failed: 0 };
  let stoppedReason: string | null = null;

  for (const [index, recipient] of recipients.entries()) {
    // Cenário crítico 8: pausa ou cancelamento no meio do lote para tudo.
    const current = await campaignStatus(campaignId);
    if (current?.status !== "running" || current.emergency_stopped_at) {
      stoppedReason = `Campanha ${current?.status ?? "removida"} durante o lote.`;
      await db.from("campaign_recipients").update({ status: "pending" }).in("id", recipients.slice(index).map((item) => item.id)).eq("status", "processing");
      break;
    }
    const { data: contact } = await db.from("contacts").select("full_name, company:companies(name)").eq("id", recipient.contact_id).single();
    const outcome = await sendWhatsApp({
      db,
      tenantId,
      contactId: recipient.contact_id,
      phoneNumberId: campaign.phone_number_id,
      origin: "campaign",
      kind: "template",
      templateId: campaign.template_id,
      parameters: renderParameters(campaign.template_parameters, contact ?? { full_name: "" }),
      purpose: campaign.purpose,
      // Mesmo contato na mesma campanha: um envio, mesmo com retry do worker.
      idempotencyKey: `campaign:${campaignId}:${recipient.contact_id}`,
    });
    const status = outcome.ok ? "sent" : outcome.blocked ? "blocked" : "failed";
    counts[status]++;
    await db
      .from("campaign_recipients")
      .update({ status, detail: outcome.ok ? null : outcome.reason.slice(0, 500), processed_at: new Date().toISOString() })
      .eq("id", recipient.id);
  }

  await db.from("campaign_runs").update({ ...counts, stopped_reason: stoppedReason, finished_at: new Date().toISOString() }).eq("id", run!.id);
  return { status: stoppedReason ? "stopped" : "sent", ...counts, reason: stoppedReason ?? undefined };
}

/** Campanhas agendadas ou em andamento de todas as empresas (tick do worker). */
export async function dispatchDueCampaigns(now = Date.now()) {
  const db = createSalesServiceClient();
  const { data: campaigns } = await db.from("campaigns").select("id, tenant_id").in("status", ["scheduled", "running"]).limit(50);
  const results = [];
  for (const campaign of campaigns ?? []) results.push({ id: campaign.id, ...(await dispatchCampaignBatch(campaign.tenant_id, campaign.id, now)) });
  return results;
}

/**
 * Follow-up automático: leads parados na etapa há N dias recebem o template
 * da regra (só número oficial; o gate barra a Evolution), com intervalo
 * mínimo entre tentativas e máximo de tentativas por lead.
 */
export async function runFollowupRules(tenantId?: string) {
  const db = createSalesServiceClient();
  let query = db.from("followup_rules").select("*").eq("active", true);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: rules } = await query;
  const summary: { ruleId: string; sent: number; blocked: number; failed: number }[] = [];

  for (const rule of rules ?? []) {
    const counts = { sent: 0, blocked: 0, failed: 0 };
    let leadsQuery = db
      .from("leads")
      .select("id, contact_id, stage_changed_at, contact:contacts!inner(full_name, phone_e164, company:companies(name)), stage:pipeline_stages!inner(is_won, is_lost)")
      .eq("tenant_id", rule.tenant_id)
      .is("deleted_at", null)
      .eq("pipeline_stages.is_won", false)
      .eq("pipeline_stages.is_lost", false)
      .lt("stage_changed_at", new Date(Date.now() - rule.idle_days * 86_400_000).toISOString())
      .not("contact_id", "is", null)
      .order("stage_changed_at")
      .limit(rule.max_per_run * 3);
    if (rule.stage_ids.length) leadsQuery = leadsQuery.in("stage_id", rule.stage_ids);
    const { data: leads } = await leadsQuery;

    for (const lead of leads ?? []) {
      if (counts.sent + counts.blocked + counts.failed >= rule.max_per_run) break;
      const { data: history } = await db.from("followup_executions").select("attempt, created_at").eq("rule_id", rule.id).eq("lead_id", lead.id).order("attempt", { ascending: false }).limit(1);
      const last = history?.[0];
      if (last && (last.attempt >= rule.max_attempts || Date.now() - new Date(last.created_at).getTime() < rule.min_interval_days * 86_400_000)) continue;
      const attempt = (last?.attempt ?? 0) + 1;
      // Reserva a tentativa antes de enviar: dois workers não enviam a mesma.
      const reserved = await db.from("followup_executions").insert({ tenant_id: rule.tenant_id, rule_id: rule.id, lead_id: lead.id, attempt, status: "failed", detail: "em envio" }).select("id").single();
      if (reserved.error) continue;
      const outcome = await sendWhatsApp({
        db,
        tenantId: rule.tenant_id,
        contactId: lead.contact_id!,
        phoneNumberId: rule.phone_number_id,
        origin: "followup",
        kind: "template",
        templateId: rule.template_id,
        parameters: renderParameters(rule.template_parameters, lead.contact!),
        purpose: rule.purpose,
        idempotencyKey: `followup:${rule.id}:${lead.id}:${attempt}`,
      });
      const status = outcome.ok ? "sent" : outcome.blocked ? "blocked" : "failed";
      counts[status]++;
      await db.from("followup_executions").update({ status, detail: outcome.ok ? null : outcome.reason.slice(0, 500) }).eq("id", reserved.data.id);
    }
    summary.push({ ruleId: rule.id, ...counts });
  }
  return summary;
}
