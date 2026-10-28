import { wrapUntrusted } from "@/lib/ai/untrusted";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { sendWhatsApp } from "../whatsapp/send";
import { loadAgent, recordToolCall, runAgent, type AgentContext } from "./engine";
import { sdrOutput, type SdrOutput } from "./schemas";

// Agente SDR: responde quem escreveu no WhatsApp. O modelo propõe resposta,
// transferência e atualização do lead; aqui o código aplica só o que passa
// pelas travas — confiança mínima, fontes citadas para preço/prazo, limite de
// respostas por conversa, gate de envio do banco.

const FACT_CLAIM = /(r\$\s?\d|\d+[.,]?\d*\s?(reais|mil)|pre[çc]o|valor de|custa|prazo de|entrega em|garantia de|certifica)/i;

type Inbound = { tenantId: string; conversationId: string; contactId: string; messageId: string; body: string | null };

export async function buildSdrPrompt(tenantId: string, conversationId: string, contactId: string, knowledgeBaseIds: string[], lastText: string) {
  const db = createSalesServiceClient();
  const [{ data: messages }, { data: contact }, { data: lead }] = await Promise.all([
    db.from("messages").select("direction, sender_type, body, occurred_at").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("occurred_at", { ascending: false }).limit(20),
    db.from("contacts").select("full_name, company:companies(name)").eq("tenant_id", tenantId).eq("id", contactId).single(),
    db.from("leads").select("qualification, score, stage:pipeline_stages(name)").eq("tenant_id", tenantId).eq("contact_id", contactId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: chunks } = await db.rpc("search_knowledge", { p_tenant: tenantId, p_query: lastText, p_knowledge_base_ids: knowledgeBaseIds, p_limit: 5 });

  const history = [...(messages ?? [])]
    .reverse()
    .filter((message) => message.body)
    .map((message) => `${message.direction === "inbound" ? "Cliente" : message.sender_type === "agent" ? "Assistente" : "Empresa"}: ${message.body}`)
    .join("\n");

  const prompt = [
    `Contato: ${contact?.full_name ?? "desconhecido"}${contact?.company?.name ? ` (${contact.company.name})` : ""}.`,
    lead ? `Lead: etapa ${lead.stage?.name ?? "—"}, interesse ${lead.qualification}, pontuação ${lead.score ?? "—"}.` : "Sem lead aberto.",
    "",
    "Trechos da base de conhecimento (cite os ids usados em cited_chunk_ids; sem trecho = sem afirmação de preço, prazo ou especificação):",
    chunks?.length ? wrapUntrusted(chunks.map((chunk) => ({ id: `chunk:${chunk.id}`, source: chunk.title, content: chunk.content })), 3000) : "(nenhum trecho encontrado)",
    "",
    "Conversa (mais antiga primeiro; a última mensagem é a que você responde):",
    wrapUntrusted([{ id: "conversa", source: "WhatsApp", content: history }], 12000),
  ].join("\n");
  return { prompt, chunkIds: new Set((chunks ?? []).map((chunk) => chunk.id)) };
}

/** Aplica a proposta do SDR. Retorna o que foi feito, para registro e testes. */
export async function applySdrOutput(params: { tenantId: string; executionId: string; context: AgentContext; conversationId: string; contactId: string; output: SdrOutput; chunkIds: Set<string> }) {
  const { tenantId, executionId, context, conversationId, contactId, output, chunkIds } = params;
  const db = createSalesServiceClient();
  const cited = output.cited_chunk_ids.map((id) => id.replace(/^chunk:/, "")).filter((id) => chunkIds.has(id));
  const unsupportedClaim = FACT_CLAIM.test(output.reply) && cited.length === 0;
  const { count: replies } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .eq("sender_type", "agent");

  let handoffReason: string | null = null;
  if (output.handoff.needed) handoffReason = output.handoff.reason || "O agente pediu um atendente.";
  else if (output.confidence < Number(context.agent.handoff_confidence)) handoffReason = `Confiança baixa (${output.confidence.toFixed(2)}).`;
  else if (unsupportedClaim) handoffReason = "Resposta citava preço, prazo ou especificação sem fonte na base de conhecimento.";
  else if ((replies ?? 0) >= context.agent.max_replies_per_conversation) handoffReason = "Limite de respostas automáticas da conversa atingido.";
  else if (!output.reply.trim()) handoffReason = "Agente não produziu resposta.";

  // Atualização do lead: só interesse e pontuação, dentro dos limites.
  if (output.lead_update.qualification || output.lead_update.score !== null) {
    const { data: lead } = await db.from("leads").select("id").eq("tenant_id", tenantId).eq("contact_id", contactId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lead) {
      const values = {
        ...(output.lead_update.qualification && { qualification: output.lead_update.qualification }),
        ...(output.lead_update.score !== null && { score: output.lead_update.score }),
      };
      await db.from("leads").update(values).eq("tenant_id", tenantId).eq("id", lead.id);
      await db.from("activities").insert({ tenant_id: tenantId, lead_id: lead.id, contact_id: contactId, kind: "note", actor_type: "agent", body: `Agente ${context.agent.name}: ${output.lead_update.note ?? "classificação atualizada pela conversa."}`.slice(0, 4000) });
      await recordToolCall(tenantId, executionId, "crm.update_lead", values, "executed", "Lead atualizado.");
    }
  }

  if (handoffReason) {
    await Promise.all([
      db.from("conversations").update({ status: "pending_human", handled_by: "human" }).eq("tenant_id", tenantId).eq("id", conversationId),
      db.from("agent_handoffs").insert({ tenant_id: tenantId, conversation_id: conversationId, execution_id: executionId, reason: handoffReason.slice(0, 500) }),
    ]);
    const { data: conversation } = await db.from("conversations").select("phone_number_id").eq("id", conversationId).single();
    await db.from("messages").insert({ tenant_id: tenantId, conversation_id: conversationId, phone_number_id: conversation!.phone_number_id, direction: "outbound", sender_type: "system", type: "note", body: `Transferido para atendimento humano: ${handoffReason}`, status: "sent" });
    await recordToolCall(tenantId, executionId, "conversation.handoff", { reason: handoffReason }, "executed", "Conversa aguardando humano.");
    if (output.reply.trim()) await recordToolCall(tenantId, executionId, "conversation.reply", { reply: output.reply.slice(0, 300) }, "rejected", handoffReason);
    return { replied: false, handoff: handoffReason };
  }

  const { data: conversation } = await db.from("conversations").select("phone_number_id").eq("id", conversationId).single();
  const outcome = await sendWhatsApp({
    db,
    tenantId,
    contactId,
    phoneNumberId: conversation!.phone_number_id,
    origin: "agent",
    kind: "free_text",
    body: output.reply,
    // A mesma execução nunca envia duas vezes.
    idempotencyKey: `agent:${executionId}`,
  });
  await recordToolCall(tenantId, executionId, "conversation.reply", { reply: output.reply.slice(0, 300), cited } as never, outcome.ok ? "executed" : "rejected", outcome.ok ? "Resposta enviada." : outcome.reason);
  return { replied: outcome.ok, handoff: null, reason: outcome.ok ? null : outcome.reason };
}

/**
 * Chamado depois de gravar uma mensagem recebida. Responde só se houver SDR
 * ativo no número e a conversa estiver com a IA (ou o agente assumir novas).
 */
export async function maybeRunSdr(inbound: Inbound) {
  if (!inbound.body?.trim()) return null;
  const db = createSalesServiceClient();
  const { data: conversation } = await db
    .from("conversations")
    .select("id, phone_number_id, handled_by, status, assigned_user_id")
    .eq("tenant_id", inbound.tenantId)
    .eq("id", inbound.conversationId)
    .single();
  if (!conversation || conversation.status !== "open") return null;
  const { data: agent } = await db
    .from("ai_agents")
    .select("id, auto_take_new_conversations")
    .eq("tenant_id", inbound.tenantId)
    .eq("type", "sdr")
    .eq("status", "active")
    .eq("phone_number_id", conversation.phone_number_id)
    .maybeSingle();
  if (!agent) return null;

  if (conversation.handled_by !== "agent") {
    if (!agent.auto_take_new_conversations || conversation.assigned_user_id) return null;
    const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id);
    if ((count ?? 0) > 1) return null;
    await db.from("conversations").update({ handled_by: "agent" }).eq("id", conversation.id);
  }

  const context = await loadAgent(inbound.tenantId, agent.id);
  if (!context) return null;
  return runSdr(inbound, context, false);
}

export async function runSdr(inbound: Inbound, context: AgentContext, isTest: boolean, provider?: Parameters<typeof runAgent>[0]["provider"]) {
  const { prompt, chunkIds } = await buildSdrPrompt(inbound.tenantId, inbound.conversationId, inbound.contactId, context.version.knowledge_base_ids, inbound.body ?? "");
  const result = await runAgent({
    tenantId: inbound.tenantId,
    context,
    trigger: isTest ? "test" : "inbound_message",
    triggerRef: inbound.messageId,
    idempotencyKey: `sdr:${inbound.messageId}`,
    isTest,
    system: context.version.system_prompt,
    prompt,
    schema: sdrOutput,
    inputSummary: { conversation_id: inbound.conversationId, message_id: inbound.messageId, chunks: chunkIds.size },
    provider,
  });
  if (result.status !== "succeeded") return result;
  const applied = await applySdrOutput({ tenantId: inbound.tenantId, executionId: result.executionId, context, conversationId: inbound.conversationId, contactId: inbound.contactId, output: result.data, chunkIds });
  return { ...result, applied };
}
