"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { chunkText, MAX_DOCUMENT_CHARS } from "@/features/ai-sales/agents/chunking";
import { loadAgent, runAgent } from "@/features/ai-sales/agents/engine";
import { AGENT_PRESETS, type AgentType } from "@/features/ai-sales/agents/presets";
import { analyzeMetrics, classifyLead, recommendFollowups } from "@/features/ai-sales/agents/runners";
import { sdrOutput } from "@/features/ai-sales/agents/schemas";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { wrapUntrusted } from "@/lib/ai/untrusted";
import { requireSecret } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Ações dos agentes e da base de conhecimento. Configuração: admin ou acima.
// Conhecimento e execuções manuais: gestor ou acima. Assumir/devolver
// conversa para a IA: vendedor ou acima.

export type AgentActionResult = ActionResult & { output?: unknown };

const uuid = z.uuid();
const NO_PERMISSION = "Sem permissão para esta ação.";

async function member(slug: string, minRole: "sales" | "manager" | "admin") {
  const membership = await findMembership(slug, minRole);
  if (!membership) return null;
  return { ...membership, db: await createSalesSessionClient() };
}

function realProviderAvailable() {
  try {
    requireSecret("AI_SALES_ANTHROPIC_API_KEY");
    return true;
  } catch {
    return false;
  }
}

// --- Agentes ------------------------------------------------------------------------

export async function createAgent(slug: string, type: AgentType): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!(type in AGENT_PRESETS)) return fail("Tipo de agente inválido.");
  const service = createSalesServiceClient();
  const [{ data: limit }, { count }] = await Promise.all([
    service.rpc("effective_limit", { p_tenant: m.tenantId, p_metric: "agents" }),
    service.from("ai_agents").select("id", { count: "exact", head: true }).eq("tenant_id", m.tenantId),
  ]);
  if ((count ?? 0) >= Number(limit ?? 0)) return fail("Limite de agentes do plano atingido.");
  const preset = AGENT_PRESETS[type];
  const { data: agent, error } = await m.db
    .from("ai_agents")
    .insert({ tenant_id: m.tenantId, type, name: preset.name, objective: preset.objective, status: "testing", created_by: m.user.id })
    .select("id")
    .single();
  if (error) return fail(dbMessage(error.message));
  const version = await m.db.rpc("create_agent_version", {
    p_tenant: m.tenantId,
    p_agent: agent.id,
    p_system_prompt: preset.prompt,
    // Sem chave própria do AI Sales, começa no modo simulado (sem custo).
    p_provider: realProviderAvailable() ? "anthropic" : "mock",
    p_model: preset.model,
    p_max_output_tokens: preset.maxOutputTokens,
    p_input_price: preset.inputPrice,
    p_output_price: preset.outputPrice,
    p_knowledge_base_ids: [],
    p_notes: "Versão inicial (modelo padrão do tipo).",
  });
  if (version.error) return fail(dbMessage(version.error.message));
  refresh();
  return { ok: true, message: `Agente criado em modo de teste: ${preset.name}.` };
}

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  objective: z.string().trim().max(1000),
  status: z.enum(["active", "inactive", "testing"]),
  phoneNumberId: z.union([uuid, z.literal("")]),
  autoTake: z.boolean(),
  handoffConfidence: z.coerce.number().min(0).max(1),
  maxReplies: z.coerce.number().int().min(1).max(50),
  dailyLimit: z.coerce.number().int().min(1).max(5000),
});

export async function updateAgentSettings(slug: string, agentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(agentId).success) return fail("Agente inválido.");
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    objective: formData.get("objective") ?? "",
    status: formData.get("status"),
    phoneNumberId: formData.get("phoneNumberId") ?? "",
    autoTake: formData.get("autoTake") === "on",
    handoffConfidence: formData.get("handoffConfidence"),
    maxReplies: formData.get("maxReplies"),
    dailyLimit: formData.get("dailyLimit"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: agent } = await m.db.from("ai_agents").select("type, current_version_id").eq("tenant_id", m.tenantId).eq("id", agentId).maybeSingle();
  if (!agent) return fail("Agente não encontrado.");
  if (parsed.data.status === "active" && !agent.current_version_id) return fail("Salve uma versão antes de ativar.");
  if (parsed.data.status === "active" && agent.type === "sdr" && !parsed.data.phoneNumberId) return fail("Escolha o número de WhatsApp em que o SDR atende.");
  const { error } = await m.db
    .from("ai_agents")
    .update({
      name: parsed.data.name,
      objective: parsed.data.objective || null,
      status: parsed.data.status,
      phone_number_id: parsed.data.phoneNumberId || null,
      auto_take_new_conversations: parsed.data.autoTake,
      handoff_confidence: parsed.data.handoffConfidence,
      max_replies_per_conversation: parsed.data.maxReplies,
      daily_executions_limit: parsed.data.dailyLimit,
    })
    .eq("tenant_id", m.tenantId)
    .eq("id", agentId);
  if (error) return fail(error.message.includes("ai_agents_active_sdr_key") ? "Já existe um SDR ativo neste número." : dbMessage(error.message));
  refresh();
  return { ok: true, message: "Configurações salvas." };
}

const versionSchema = z.object({
  prompt: z.string().trim().min(20, "Prompt muito curto.").max(12000),
  provider: z.enum(["anthropic", "mock"]),
  model: z.string().trim().regex(/^[a-z0-9.-]{2,80}$/, "Modelo inválido."),
  maxOutputTokens: z.coerce.number().int().min(256).max(4000),
  inputPrice: z.coerce.number().min(0).max(1000),
  outputPrice: z.coerce.number().min(0).max(1000),
  knowledgeBaseIds: z.array(uuid).max(10),
  notes: z.string().trim().max(500),
});

export async function saveAgentVersion(slug: string, agentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(agentId).success) return fail("Agente inválido.");
  const parsed = versionSchema.safeParse({
    prompt: formData.get("prompt"),
    provider: formData.get("provider"),
    model: formData.get("model"),
    maxOutputTokens: formData.get("maxOutputTokens"),
    inputPrice: formData.get("inputPrice"),
    outputPrice: formData.get("outputPrice"),
    knowledgeBaseIds: formData.getAll("knowledgeBaseIds").map(String),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (parsed.data.provider === "anthropic" && !realProviderAvailable()) return fail("Chave da Anthropic do AI Sales não configurada (AI_SALES_ANTHROPIC_API_KEY). Use o modo simulado.");
  const { data, error } = await m.db.rpc("create_agent_version", {
    p_tenant: m.tenantId,
    p_agent: agentId,
    p_system_prompt: parsed.data.prompt,
    p_provider: parsed.data.provider,
    p_model: parsed.data.model,
    p_max_output_tokens: parsed.data.maxOutputTokens,
    p_input_price: parsed.data.inputPrice,
    p_output_price: parsed.data.outputPrice,
    p_knowledge_base_ids: parsed.data.knowledgeBaseIds,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return fail(error.message.includes("invalid_knowledge_base") ? "Base de conhecimento inválida." : dbMessage(error.message));
  refresh();
  return { ok: true, message: `Versão ${data.version} salva e em uso.` };
}

export async function rollbackAgentVersion(slug: string, agentId: string, versionId: string): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(agentId).success || !uuid.safeParse(versionId).success) return fail("Dados inválidos.");
  const { data: version } = await m.db.from("agent_versions").select("version").eq("tenant_id", m.tenantId).eq("agent_id", agentId).eq("id", versionId).maybeSingle();
  if (!version) return fail("Versão não encontrada.");
  const { error } = await m.db.from("ai_agents").update({ current_version_id: versionId }).eq("tenant_id", m.tenantId).eq("id", agentId);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: `Voltou para a versão ${version.version}.` };
}

/** Console de teste do SDR: sempre simulado, nunca envia nada. */
export async function testSdr(slug: string, agentId: string, _prev: AgentActionResult | null, formData: FormData): Promise<AgentActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail(NO_PERMISSION);
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  if (!message) return fail("Escreva uma mensagem de cliente para testar.");
  const context = uuid.safeParse(agentId).success ? await loadAgent(m.tenantId, agentId) : null;
  if (!context || context.agent.type !== "sdr") return fail("Agente SDR não encontrado.");
  const service = createSalesServiceClient();
  const { data: chunks } = await service.rpc("search_knowledge", { p_tenant: m.tenantId, p_query: message, p_knowledge_base_ids: context.version.knowledge_base_ids, p_limit: 5 });
  const prompt = [
    "Trechos da base de conhecimento:",
    chunks?.length ? wrapUntrusted(chunks.map((chunk) => ({ id: `chunk:${chunk.id}`, source: chunk.title, content: chunk.content })), 3000) : "(nenhum trecho encontrado)",
    "Conversa:",
    wrapUntrusted([{ id: "conversa", source: "teste", content: `Cliente: ${message}` }]),
  ].join("\n");
  const result = await runAgent({
    tenantId: m.tenantId,
    context,
    trigger: "test",
    idempotencyKey: `test:${crypto.randomUUID()}`,
    isTest: true,
    system: context.version.system_prompt,
    prompt,
    schema: sdrOutput,
    inputSummary: { test: true },
  });
  if (result.status !== "succeeded") return fail(result.reason);
  refresh();
  return { ok: true, message: `Teste concluído (simulado, ${chunks?.length ?? 0} trecho(s) encontrado(s)). Nada foi enviado.`, output: result.data };
}

export async function runSupportAgent(slug: string, agentId: string, test: boolean): Promise<AgentActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const context = uuid.safeParse(agentId).success ? await loadAgent(m.tenantId, agentId) : null;
  if (!context) return fail("Agente não encontrado ou sem versão.");
  if (!test && context.agent.status !== "active") return fail("Ative o agente para rodar de verdade, ou use o teste.");
  const result =
    context.agent.type === "followup" ? await recommendFollowups(m.tenantId, context, test) : context.agent.type === "analyst" ? await analyzeMetrics(m.tenantId, context, test) : null;
  if (!result) return fail("Este agente roda a partir de outra tela.");
  if (result.status !== "succeeded") return fail(result.reason);
  refresh();
  return { ok: true, message: test ? "Execução de teste concluída." : "Execução concluída.", output: result.data };
}

export async function classifyLeadWithAi(slug: string, leadId: string): Promise<ActionResult> {
  const m = await member(slug, "sales");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(leadId).success) return fail("Lead inválido.");
  // O lead precisa ser visível para quem pede (RLS da sessão).
  const { data: lead } = await m.db.from("leads").select("id").eq("tenant_id", m.tenantId).eq("id", leadId).maybeSingle();
  if (!lead) return fail("Lead não encontrado.");
  const { data: agent } = await createSalesServiceClient().from("ai_agents").select("id").eq("tenant_id", m.tenantId).eq("type", "capture").eq("status", "active").limit(1).maybeSingle();
  if (!agent) return fail("Nenhum agente de classificação ativo. Crie e ative em Agentes.");
  const context = await loadAgent(m.tenantId, agent.id);
  if (!context) return fail("Agente sem versão.");
  const result = await classifyLead(m.tenantId, context, leadId);
  if (result.status !== "succeeded") return fail(result.reason);
  refresh();
  return { ok: true, message: `Classificado: pontuação ${result.data.score}.` };
}

/** Passa a conversa para a IA ou de volta para humano (e resolve a transferência aberta). */
export async function setConversationHandler(slug: string, conversationId: string, handler: "agent" | "human"): Promise<ActionResult> {
  const m = await member(slug, "sales");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(conversationId).success || !["agent", "human"].includes(handler)) return fail("Dados inválidos.");
  const { data, error } = await m.db
    .from("conversations")
    .update(handler === "agent" ? { handled_by: "agent", status: "open" } : { handled_by: "human", assigned_user_id: m.user.id })
    .eq("tenant_id", m.tenantId)
    .eq("id", conversationId)
    .select("id");
  if (error) return fail(dbMessage(error.message));
  if (!data?.length) return fail("Conversa não encontrada.");
  await m.db.from("agent_handoffs").update({ status: "resolved", resolved_by: m.user.id, resolved_at: new Date().toISOString() }).eq("tenant_id", m.tenantId).eq("conversation_id", conversationId).eq("status", "open");
  refresh();
  return { ok: true, message: handler === "agent" ? "A IA volta a responder esta conversa." : "Você assumiu a conversa; a IA para de responder." };
}

// --- Conhecimento -----------------------------------------------------------------

export async function createKnowledgeBase(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const parsed = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500) }).safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return fail("Informe um nome (2 a 80 caracteres).");
  const { error } = await m.db.from("knowledge_bases").insert({ tenant_id: m.tenantId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Base criada." };
}

export async function addKnowledgeDocument(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const baseId = String(formData.get("knowledgeBaseId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const file = formData.get("file");
  let content = String(formData.get("content") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_DOCUMENT_CHARS * 2 || !/\.(txt|md)$/i.test(file.name)) return fail("Envie .txt ou .md de até 400 KB (PDF entra depois).");
    content = await file.text();
  }
  content = content.trim();
  if (!uuid.safeParse(baseId).success || title.length < 2) return fail("Escolha a base e dê um título.");
  if (!content || content.length > MAX_DOCUMENT_CHARS) return fail(`Conteúdo vazio ou maior que ${MAX_DOCUMENT_CHARS.toLocaleString("pt-BR")} caracteres.`);
  const chunks = chunkText(content);
  const { data: document, error } = await m.db
    .from("knowledge_documents")
    .insert({ tenant_id: m.tenantId, knowledge_base_id: baseId, title, content, chunk_count: chunks.length, created_by: m.user.id })
    .select("id")
    .single();
  if (error) return fail(dbMessage(error.message));
  const inserted = await m.db.from("knowledge_chunks").insert(chunks.map((chunk, index) => ({ tenant_id: m.tenantId, document_id: document.id, knowledge_base_id: baseId, chunk_index: index, content: chunk })));
  if (inserted.error) {
    await m.db.from("knowledge_documents").delete().eq("id", document.id);
    return fail(dbMessage(inserted.error.message));
  }
  refresh();
  return { ok: true, message: `Documento adicionado (${chunks.length} trecho(s)).` };
}

export async function deleteKnowledgeDocument(slug: string, documentId: string): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(documentId).success) return fail("Documento inválido.");
  const { error } = await m.db.from("knowledge_documents").delete().eq("tenant_id", m.tenantId).eq("id", documentId);
  if (error) return fail(dbMessage(error.message));
  refresh();
  return { ok: true, message: "Documento removido." };
}

export async function searchKnowledgeTest(slug: string, _prev: AgentActionResult | null, formData: FormData): Promise<AgentActionResult> {
  const m = await member(slug, "sales");
  if (!m) return fail(NO_PERMISSION);
  const query = String(formData.get("query") ?? "").trim().slice(0, 300);
  if (!query) return fail("Digite uma pergunta.");
  const { data, error } = await m.db.rpc("search_knowledge", { p_tenant: m.tenantId, p_query: query, p_knowledge_base_ids: [], p_limit: 5 });
  if (error) return fail(dbMessage(error.message));
  return { ok: true, message: `${data.length} trecho(s) encontrado(s).`, output: data };
}
