import type { z } from "zod";

import { createProvider, type Effort, type LlmProvider } from "@/lib/ai/provider";
import { estimateCost, usageCost } from "@/lib/ai/run-agent";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";
import type { Database, Json } from "@/lib/supabase/sales.types";

import { MockLlmProvider } from "./mock-provider";

// Executor dos agentes do AI Sales. Independente da interface: recebe o
// agente, monta nada (o prompt vem pronto do agente específico) e cuida de
// idempotência, limites, orçamento, chamada ao provedor, validação da saída
// e registro em agent_executions. Roda no servidor com a secret key.

type Agent = Database["public"]["Tables"]["ai_agents"]["Row"];
type Version = Database["public"]["Tables"]["agent_versions"]["Row"];

export type AgentContext = { agent: Agent; version: Version };

export type RunInput<T> = {
  tenantId: string;
  context: AgentContext;
  trigger: "inbound_message" | "manual" | "test" | "schedule";
  triggerRef?: string;
  /** Mesma chave = mesma execução (nunca duas respostas para a mesma mensagem). */
  idempotencyKey: string;
  isTest?: boolean;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort?: Effort;
  inputSummary: Record<string, Json>;
  /** Injetável nos testes. */
  provider?: LlmProvider;
};

export type RunResult<T> =
  | { status: "succeeded"; executionId: string; data: T; costUsd: number }
  | { status: "duplicate" | "skipped" | "failed"; executionId: string | null; reason: string };

/** Agente com a versão atual, só se pertencer à empresa. */
export async function loadAgent(tenantId: string, agentId: string): Promise<AgentContext | null> {
  const db = createSalesServiceClient();
  const { data: agent } = await db.from("ai_agents").select("*").eq("tenant_id", tenantId).eq("id", agentId).maybeSingle();
  if (!agent?.current_version_id) return null;
  const { data: version } = await db.from("agent_versions").select("*").eq("tenant_id", tenantId).eq("id", agent.current_version_id).maybeSingle();
  return version ? { agent, version } : null;
}

function providerFor(version: Version, type: Agent["type"], isTest: boolean): LlmProvider {
  // Modo de teste nunca gasta: usa o simulado mesmo que a versão seja real.
  if (isTest || version.provider === "mock") return new MockLlmProvider(type);
  return createProvider(version.provider, "AI_SALES_ANTHROPIC_API_KEY");
}

export async function runAgent<T>(input: RunInput<T>): Promise<RunResult<T>> {
  const db = createSalesServiceClient();
  const { agent, version } = input.context;
  const isTest = input.isTest ?? false;
  if (!isTest && agent.status !== "active") return { status: "skipped", executionId: null, reason: "Agente inativo." };

  const { count: today } = await db
    .from("agent_executions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId)
    .eq("agent_id", agent.id)
    .gt("started_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((today ?? 0) >= agent.daily_executions_limit) return { status: "skipped", executionId: null, reason: "Limite diário de execuções do agente atingido." };

  const { data: execution, error } = await db
    .from("agent_executions")
    .insert({
      tenant_id: input.tenantId,
      agent_id: agent.id,
      version_id: version.id,
      trigger_type: input.trigger,
      trigger_ref: input.triggerRef ?? null,
      idempotency_key: input.idempotencyKey,
      is_test: isTest,
      input_summary: input.inputSummary,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { status: "duplicate", executionId: null, reason: "Execução já feita para este evento." };
    return { status: "failed", executionId: null, reason: `Falha ao registrar execução: ${error.message}` };
  }

  const prices = { inputPrice: Number(version.input_price_per_mtok), outputPrice: Number(version.output_price_per_mtok), maxOutputTokens: version.max_output_tokens };
  const provider = input.provider ?? providerFor(version, agent.type, isTest);
  const paid = provider.name !== "mock";
  const estimated = paid ? estimateCost(input.system.length + input.prompt.length, prices) : 0;
  let reservationId: string | null = null;
  const finish = (values: Database["public"]["Tables"]["agent_executions"]["Update"]) =>
    db.from("agent_executions").update({ ...values, finished_at: new Date().toISOString() }).eq("id", execution.id);

  if (paid) {
    const reservation = await db.rpc("reserve_usage", { p_tenant: input.tenantId, p_metric: "ai_cost_usd", p_amount: Number(estimated.toFixed(6)) || 0.000001, p_key: `agent:${execution.id}` });
    if (reservation.error) {
      const reason = reservation.error.message.includes("usage_limit_exceeded") ? "Teto mensal de IA da empresa atingido." : "Sem orçamento de IA configurado.";
      await finish({ status: "skipped", error: reason });
      return { status: "skipped", executionId: execution.id, reason };
    }
    reservationId = reservation.data;
  }

  const started = performance.now();
  try {
    const result = await provider.generate({ model: version.model, system: input.system, prompt: input.prompt, schema: input.schema, maxOutputTokens: version.max_output_tokens, effort: input.effort ?? "low" });
    // Revalida: saída de IA nunca é confiável.
    const data = input.schema.parse(result.data);
    const costUsd = paid ? usageCost(result.usage, prices) : 0;
    if (reservationId) await db.rpc("settle_usage", { p_tenant: input.tenantId, p_reservation: reservationId, p_actual: Number(costUsd.toFixed(6)), p_source_type: "agent_execution", p_source_id: execution.id });
    await finish({
      status: "succeeded",
      output: data as unknown as Json,
      token_usage: result.usage as unknown as Json,
      estimated_cost_usd: Number(estimated.toFixed(6)),
      cost_usd: Number(costUsd.toFixed(6)),
      latency_ms: Math.round(performance.now() - started),
      reservation_id: reservationId,
    });
    return { status: "succeeded", executionId: execution.id, data, costUsd };
  } catch (cause) {
    const reason = (cause instanceof Error ? cause.message : "Erro desconhecido").slice(0, 900);
    if (reservationId) await db.rpc("release_usage", { p_tenant: input.tenantId, p_reservation: reservationId });
    await finish({ status: "failed", error: reason, latency_ms: Math.round(performance.now() - started), reservation_id: reservationId });
    return { status: "failed", executionId: execution.id, reason };
  }
}

/** Registro de cada ação proposta pelo agente e do que o sistema decidiu. */
export async function recordToolCall(tenantId: string, executionId: string, tool: string, args: Record<string, Json>, decision: "executed" | "rejected" | "needs_approval", result: string) {
  await createSalesServiceClient()
    .from("agent_tool_calls")
    .insert({ tenant_id: tenantId, execution_id: executionId, tool, arguments: args, decision, result: result.slice(0, 1000) });
}
