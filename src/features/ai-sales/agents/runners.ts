import { randomUUID } from "node:crypto";

import { wrapUntrusted } from "@/lib/ai/untrusted";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import type { Json } from "@/lib/supabase/sales.types";

import { recordToolCall, runAgent, type AgentContext } from "./engine";
import { analystOutput, captureOutput, followupOutput } from "./schemas";

// Agentes de apoio, sempre disparados por alguém da empresa (manual):
// classificação de lead (aplica interesse/pontuação), follow-up e análise
// (só recomendações; nenhum envio automático nesta fase).

export async function classifyLead(tenantId: string, context: AgentContext, leadId: string, isTest = false) {
  const db = createSalesServiceClient();
  const { data: lead } = await db
    .from("leads")
    .select("id, title, qualification, score, created_at, contact:contacts(full_name, job_title, city, state, email, phone_e164), company:companies(name, city, state, cnae), source:lead_sources(name)")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .single();
  if (!lead) return { status: "failed" as const, executionId: null, reason: "Lead não encontrado." };
  const { data: activities } = await db.from("activities").select("kind, body, created_at").eq("tenant_id", tenantId).eq("lead_id", leadId).order("created_at", { ascending: false }).limit(15);
  const summary = {
    titulo: lead.title,
    origem: lead.source?.name,
    contato: { cargo: lead.contact?.job_title, cidade: lead.contact?.city, uf: lead.contact?.state, tem_email: Boolean(lead.contact?.email), tem_telefone: Boolean(lead.contact?.phone_e164) },
    empresa: lead.company,
    historico: (activities ?? []).map((activity) => `${activity.kind}: ${activity.body ?? ""}`.slice(0, 300)),
  };
  const result = await runAgent({
    tenantId,
    context,
    trigger: isTest ? "test" : "manual",
    triggerRef: leadId,
    idempotencyKey: `capture:${leadId}:${randomUUID()}`,
    isTest,
    system: context.version.system_prompt,
    prompt: wrapUntrusted([{ id: "lead", source: "CRM", content: JSON.stringify(summary) }], 8000),
    schema: captureOutput,
    inputSummary: { lead_id: leadId },
  });
  if (result.status !== "succeeded" || isTest) return result;
  await db.from("leads").update({ qualification: result.data.qualification, score: result.data.score }).eq("tenant_id", tenantId).eq("id", leadId);
  await db.from("activities").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    kind: "note",
    actor_type: "agent",
    body: `Classificação por IA (${context.agent.name}): pontuação ${result.data.score}. ${result.data.reasons.join("; ")}${result.data.missing_info.length ? `. Falta: ${result.data.missing_info.join(", ")}` : ""}`.slice(0, 4000),
  });
  await recordToolCall(tenantId, result.executionId, "crm.update_lead", { qualification: result.data.qualification, score: result.data.score }, "executed", "Lead classificado.");
  return result;
}

export async function recommendFollowups(tenantId: string, context: AgentContext, isTest = false) {
  const db = createSalesServiceClient();
  const idleSince = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: leads } = await db
    .from("leads")
    .select("id, title, qualification, score, stage_changed_at, contact:contacts(full_name, phone_e164), stage:pipeline_stages!inner(name, is_won, is_lost)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .eq("pipeline_stages.is_won", false)
    .eq("pipeline_stages.is_lost", false)
    .lt("stage_changed_at", idleSince)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(20);
  const phones = (leads ?? []).map((lead) => lead.contact?.phone_e164).filter((phone): phone is string => Boolean(phone));
  const { data: suppressed } = phones.length ? await db.from("suppression_list").select("identifier").eq("tenant_id", tenantId).in("identifier", phones) : { data: [] };
  const blocked = new Set((suppressed ?? []).map((item) => item.identifier));
  const lines = (leads ?? []).map((lead) =>
    [`lead_id=${lead.id}`, `nome=${lead.contact?.full_name ?? "—"}`, `etapa=${lead.stage?.name}`, `interesse=${lead.qualification}`, `parado_desde=${lead.stage_changed_at.slice(0, 10)}`, blocked.has(lead.contact?.phone_e164 ?? "") ? "descadastrado=sim" : ""].join(" "),
  );
  if (!lines.length) return { status: "skipped" as const, executionId: null, reason: "Nenhuma negociação parada há mais de 7 dias." };
  return runAgent({
    tenantId,
    context,
    trigger: isTest ? "test" : "manual",
    idempotencyKey: `followup:${randomUUID()}`,
    isTest,
    system: context.version.system_prompt,
    prompt: wrapUntrusted([{ id: "leads", source: "CRM", content: lines.join("\n") }], 10000),
    schema: followupOutput,
    inputSummary: { leads: lines.length as Json },
  });
}

export async function analyzeMetrics(tenantId: string, context: AgentContext, isTest = false) {
  const db = createSalesServiceClient();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const { data: metrics, error } = await db.rpc("crm_dashboard", { p_tenant: tenantId, p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return { status: "failed" as const, executionId: null, reason: "Não foi possível ler os indicadores." };
  return runAgent({
    tenantId,
    context,
    trigger: isTest ? "test" : "manual",
    idempotencyKey: `analyst:${randomUUID()}`,
    isTest,
    system: context.version.system_prompt,
    prompt: `Indicadores dos últimos 30 dias:\n${JSON.stringify(metrics)}`,
    schema: analystOutput,
    inputSummary: { period_days: 30 },
  });
}
