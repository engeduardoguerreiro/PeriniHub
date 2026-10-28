"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { dispatchCampaignBatch, runFollowupRules } from "@/features/ai-sales/campaigns/dispatch";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Ações de campanhas e follow-up: gestor ou acima. O ciclo de vida passa
// sempre por campaign_transition (o banco valida transição, papel, aprovação
// por outra pessoa e motivo). Cada envio passa pelo gate na hora.

const uuid = z.uuid();
const NO_PERMISSION = "Só gestores, administradores e proprietários gerenciam campanhas.";

const CAMPAIGN_MESSAGES: Record<string, string> = {
  invalid_transition: "Essa mudança não é permitida no estado atual da campanha.",
  audience_required: "Monte o público (com ao menos um contato elegível) antes de enviar para aprovação.",
  approval_by_other: "A campanha precisa ser aprovada por outro gestor (quem criou não aprova).",
  reason_required: "Informe o motivo (mínimo 3 caracteres).",
  campaign_not_draft: "Só é possível alterar o público de campanhas em rascunho.",
};

function message(error: string | undefined) {
  const code = Object.keys(CAMPAIGN_MESSAGES).find((key) => error?.includes(key));
  return code ? CAMPAIGN_MESSAGES[code] : dbMessage(error);
}

async function manager(slug: string) {
  const membership = await findMembership(slug, "manager");
  if (!membership) return null;
  return { ...membership, db: await createSalesSessionClient() };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à campanha.").max(120),
  objective: z.string().trim().max(1000),
  purpose: z.enum(["marketing", "sales_followup", "service", "transactional"]),
  phoneNumberId: uuid,
  templateId: uuid,
  parameters: z.array(z.string().trim().min(1, "Preencha todas as variáveis do template.").max(500)).max(10),
  stageIds: z.array(uuid).max(30),
  sourceIds: z.array(uuid).max(30),
  tagIds: z.array(uuid).max(30),
  qualifications: z.array(z.enum(["unknown", "cold", "warm", "hot"])).max(4),
  windowStart: time,
  windowEnd: time,
  hourlyLimit: z.coerce.number().int().min(1).max(1000),
  dailyLimit: z.coerce.number().int().min(1).max(10000),
  totalLimit: z.coerce.number().int().min(1).max(100000),
});

export async function createCampaign(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    objective: formData.get("objective") ?? "",
    purpose: formData.get("purpose"),
    phoneNumberId: formData.get("phoneNumberId"),
    templateId: formData.get("templateId"),
    parameters: formData.getAll("param").map(String),
    stageIds: formData.getAll("stageIds").map(String),
    sourceIds: formData.getAll("sourceIds").map(String),
    tagIds: formData.getAll("tagIds").map(String),
    qualifications: formData.getAll("qualifications").map(String),
    windowStart: formData.get("windowStart"),
    windowEnd: formData.get("windowEnd"),
    hourlyLimit: formData.get("hourlyLimit"),
    dailyLimit: formData.get("dailyLimit"),
    totalLimit: formData.get("totalLimit"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const data = parsed.data;
  if (data.windowStart >= data.windowEnd) return fail("O horário de início da janela precisa ser antes do fim.");

  // Campanha só por número oficial (a Evolution só permite envio manual).
  const { data: number } = await m.db.from("whatsapp_phone_numbers").select("account_id, status, account:whatsapp_accounts(provider)").eq("tenant_id", m.tenantId).eq("id", data.phoneNumberId).maybeSingle();
  if (!number || number.status !== "active") return fail("Escolha um número de WhatsApp ativo.");
  if (number.account?.provider === "evolution") return fail("Campanhas não podem usar a conexão não oficial (Evolution).");
  const { data: template } = await m.db.from("whatsapp_templates").select("status, account_id, category").eq("tenant_id", m.tenantId).eq("id", data.templateId).maybeSingle();
  if (!template || template.account_id !== number.account_id || template.status !== "APPROVED") return fail("Escolha um template aprovado deste número.");
  if (template.category === "marketing" && data.purpose !== "marketing") return fail("Template de marketing exige a finalidade “Marketing e ofertas”.");

  const { data: campaign, error } = await m.db
    .from("campaigns")
    .insert({
      tenant_id: m.tenantId,
      name: data.name,
      objective: data.objective || null,
      purpose: data.purpose,
      phone_number_id: data.phoneNumberId,
      template_id: data.templateId,
      template_parameters: data.parameters,
      audience_filter: { stage_ids: data.stageIds, source_ids: data.sourceIds, tag_ids: data.tagIds, qualifications: data.qualifications },
      window_start: data.windowStart,
      window_end: data.windowEnd,
      hourly_limit: data.hourlyLimit,
      daily_limit: data.dailyLimit,
      total_limit: data.totalLimit,
      created_by: m.user.id,
    })
    .select("id")
    .single();
  if (error) return fail(message(error.message));
  redirect(orgPath(slug, `campaigns/${campaign.id}`));
}

export async function buildAudience(slug: string, campaignId: string): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(campaignId).success) return fail("Campanha inválida.");
  const { data, error } = await m.db.rpc("campaign_build_audience", { p_tenant: m.tenantId, p_campaign: campaignId });
  if (error) return fail(message(error.message));
  refresh();
  const counts = data as { eligible: number; excluded: number };
  return { ok: true, message: `Público montado: ${counts.eligible} elegível(is), ${counts.excluded} excluído(s).` };
}

type Target = "awaiting_approval" | "scheduled" | "running" | "paused" | "canceled" | "draft";

export async function transitionCampaign(slug: string, campaignId: string, to: Target, emergency = false, reason?: string): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(campaignId).success) return fail("Campanha inválida.");
  const { error } = await m.db.rpc("campaign_transition", { p_tenant: m.tenantId, p_campaign: campaignId, p_to: to, p_reason: reason ?? undefined, p_emergency: emergency });
  if (error) return fail(message(error.message));
  refresh();
  const labels: Record<Target, string> = {
    awaiting_approval: "Enviada para aprovação.",
    scheduled: "Aprovada e agendada.",
    running: "Em andamento.",
    paused: emergency ? "Pausa de emergência aplicada: nenhum novo envio sai." : "Pausada.",
    canceled: "Cancelada.",
    draft: "Voltou para rascunho.",
  };
  return { ok: true, message: labels[to] };
}

/** Envia o próximo lote agora (sem esperar o worker), dentro de todos os limites. */
export async function dispatchNow(slug: string, campaignId: string): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(campaignId).success) return fail("Campanha inválida.");
  const { data: campaign } = await m.db.from("campaigns").select("id").eq("tenant_id", m.tenantId).eq("id", campaignId).maybeSingle();
  if (!campaign) return fail("Campanha não encontrada.");
  const result = await dispatchCampaignBatch(m.tenantId, campaignId);
  refresh();
  if (result.status === "sent") return { ok: true, message: `Lote enviado: ${result.sent} enviada(s), ${result.blocked} bloqueada(s) pelo gate, ${result.failed} com falha.` };
  if (result.status === "completed") return { ok: true, message: "Campanha concluída: não há mais destinatários." };
  return fail(result.reason ?? "Nada a enviar agora.");
}

// --- Follow-up ----------------------------------------------------------------------

const ruleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  idleDays: z.coerce.number().int().min(1).max(180),
  stageIds: z.array(uuid).max(30),
  phoneNumberId: uuid,
  templateId: uuid,
  parameters: z.array(z.string().trim().min(1).max(500)).max(10),
  maxAttempts: z.coerce.number().int().min(1).max(5),
  minIntervalDays: z.coerce.number().int().min(1).max(60),
  maxPerRun: z.coerce.number().int().min(1).max(200),
});

export async function createFollowupRule(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = ruleSchema.safeParse({
    name: formData.get("name"),
    idleDays: formData.get("idleDays"),
    stageIds: formData.getAll("stageIds").map(String),
    phoneNumberId: formData.get("phoneNumberId"),
    templateId: formData.get("templateId"),
    parameters: formData.getAll("param").map(String),
    maxAttempts: formData.get("maxAttempts"),
    minIntervalDays: formData.get("minIntervalDays"),
    maxPerRun: formData.get("maxPerRun"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: number } = await m.db.from("whatsapp_phone_numbers").select("account_id, account:whatsapp_accounts(provider)").eq("tenant_id", m.tenantId).eq("id", parsed.data.phoneNumberId).maybeSingle();
  if (!number || number.account?.provider === "evolution") return fail("Follow-up automático só por número oficial.");
  const { data: template } = await m.db.from("whatsapp_templates").select("status, account_id, category").eq("tenant_id", m.tenantId).eq("id", parsed.data.templateId).maybeSingle();
  if (!template || template.account_id !== number.account_id || template.status !== "APPROVED") return fail("Escolha um template aprovado deste número.");
  const { error } = await m.db.from("followup_rules").insert({
    tenant_id: m.tenantId,
    name: parsed.data.name,
    idle_days: parsed.data.idleDays,
    stage_ids: parsed.data.stageIds,
    phone_number_id: parsed.data.phoneNumberId,
    template_id: parsed.data.templateId,
    template_parameters: parsed.data.parameters,
    purpose: template.category === "marketing" ? "marketing" : "sales_followup",
    max_attempts: parsed.data.maxAttempts,
    min_interval_days: parsed.data.minIntervalDays,
    max_per_run: parsed.data.maxPerRun,
    created_by: m.user.id,
  });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Regra criada (inativa). Ative quando revisar." };
}

export async function setFollowupRuleActive(slug: string, ruleId: string, active: boolean): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(ruleId).success) return fail("Regra inválida.");
  const { data, error } = await m.db.from("followup_rules").update({ active }).eq("tenant_id", m.tenantId).eq("id", ruleId).select("id");
  if (error) return fail(dbMessage(error.message));
  if (!data?.length) return fail("Regra não encontrada.");
  refresh();
  return { ok: true, message: active ? "Regra ativada." : "Regra desativada." };
}

export async function runFollowupsNow(slug: string): Promise<ActionResult> {
  const m = await manager(slug);
  if (!m) return fail(NO_PERMISSION);
  const summary = await runFollowupRules(m.tenantId);
  refresh();
  const totals = summary.reduce((acc, item) => ({ sent: acc.sent + item.sent, blocked: acc.blocked + item.blocked, failed: acc.failed + item.failed }), { sent: 0, blocked: 0, failed: 0 });
  return { ok: true, message: `${summary.length} regra(s) ativa(s): ${totals.sent} enviada(s), ${totals.blocked} bloqueada(s) pelo gate, ${totals.failed} com falha.` };
}
