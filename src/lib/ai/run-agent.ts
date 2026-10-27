import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { Database, Json } from "@/lib/supabase/database.types";

import { AgentError, dbStopCode } from "./errors";
import { createProvider, type Effort, type LlmProvider, type LlmUsage } from "./provider";

export type AgentName = "researcher" | "curator" | "writer" | "fact_checker" | "seo_editor";
type Db = SupabaseClient<Database>;

export type AgentModel = {
  provider: string;
  model: string;
  maxOutputTokens: number;
  inputPrice: number;
  outputPrice: number;
  enabled: boolean;
};

export async function getAgentModel(db: Db, agent: AgentName): Promise<AgentModel> {
  const { data, error } = await db.from("news_agent_models").select("*").eq("agent_name", agent).maybeSingle();
  if (error) throw new AgentError(`Falha ao ler modelo do agente ${agent}: ${error.message}`, "db", true);
  if (!data) throw new AgentError(`Agente ${agent} sem modelo configurado`, "no_model", false);
  return {
    provider: data.provider,
    model: data.model,
    maxOutputTokens: data.max_output_tokens,
    inputPrice: Number(data.input_price_per_mtok),
    outputPrice: Number(data.output_price_per_mtok),
    enabled: data.enabled,
  };
}

/** Custo em US$ a partir do uso real (cache de leitura cobrado a 10% do input). */
export function usageCost(usage: LlmUsage, model: Pick<AgentModel, "inputPrice" | "outputPrice">) {
  const input = usage.input + usage.cacheWrite * 1.25 + usage.cacheRead * 0.1;
  return (input * model.inputPrice + usage.output * model.outputPrice) / 1_000_000;
}

/**
 * Teto conservador reservado antes da chamada: ~3 caracteres por token na
 * entrada e o máximo de saída (inclui raciocínio). Se o teto mensal não
 * comporta a reserva, a chamada nem acontece.
 */
export function estimateCost(promptChars: number, model: Pick<AgentModel, "inputPrice" | "outputPrice" | "maxOutputTokens">) {
  const inputTokens = Math.ceil(promptChars / 3);
  return (inputTokens * model.inputPrice + model.maxOutputTokens * model.outputPrice) / 1_000_000;
}

export type RunAgentParams<T> = {
  db: Db;
  agent: AgentName;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort: Effort;
  /** Referência do que foi processado (ids), gravada em news_agent_runs. */
  input: Record<string, Json>;
  /** Evita cobrar duas vezes a mesma etapa (ex.: "writer:<candidateId>"). */
  idempotencyKey?: string;
  /** Id da execução no Trigger.dev, para cruzar logs. */
  runId?: string;
  /** Injetável nos testes. */
  provider?: LlmProvider;
};

export type RunAgentResult<T> = { data: T; runRowId: string; costUsd: number; model: string };

/**
 * Executa um agente com contabilidade completa: reserva orçamento no banco
 * (função transacional), chama o provedor, valida a saída com Zod e registra
 * tokens, latência, custo e erro em news_agent_runs.
 */
export async function runAgent<T>(params: RunAgentParams<T>): Promise<RunAgentResult<T>> {
  const { db, agent, system, prompt, schema, effort, input, idempotencyKey, runId } = params;
  const config = await getAgentModel(db, agent);
  if (!config.enabled) throw new AgentError(`Agente ${agent} desativado no painel`, "agent_disabled", false);

  const estimated = estimateCost(system.length + prompt.length, config);
  const { data: runRowId, error: startError } = await db.rpc("news_start_agent_run", {
    p_agent_name: agent,
    p_estimated_cost: Number(estimated.toFixed(6)),
    p_input_reference: input,
    p_run_id: runId,
    p_idempotency_key: idempotencyKey,
    p_provider: config.provider,
    p_model: config.model,
  });
  if (startError || !runRowId) {
    const stop = dbStopCode(startError?.message);
    throw new AgentError(startError?.message ?? "Falha ao registrar execução", stop ?? "db", stop === null);
  }

  const started = performance.now();
  try {
    const provider = params.provider ?? createProvider(config.provider);
    const result = await provider.generate({
      model: config.model,
      system,
      prompt,
      schema,
      maxOutputTokens: config.maxOutputTokens,
      effort,
    });
    // Revalida: o SDK já valida pelo schema, mas a regra é não confiar em saída de IA.
    const data = schema.parse(result.data);
    const costUsd = usageCost(result.usage, config);

    await db
      .from("news_agent_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        latency_ms: Math.round(performance.now() - started),
        token_usage: result.usage,
        actual_cost_if_available: Number(costUsd.toFixed(6)),
        model: result.model,
      })
      .eq("id", runRowId);

    return { data, runRowId, costUsd, model: result.model };
  } catch (error) {
    const agentError =
      error instanceof AgentError
        ? error
        : new AgentError(error instanceof Error ? error.message : "Erro desconhecido", "unknown", false);
    // Com resposta rejeitada, os tokens já foram cobrados e entram no custo;
    // sem resposta (rede, 5xx), o custo real é 0 e a reserva é liberada.
    const spent = agentError.usage ? usageCost(agentError.usage, config) : 0;
    await db
      .from("news_agent_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: Math.round(performance.now() - started),
        error_details: { code: agentError.code, message: agentError.message.slice(0, 1000), retryable: agentError.retryable },
        token_usage: agentError.usage ?? null,
        actual_cost_if_available: Number(spent.toFixed(6)),
      })
      .eq("id", runRowId);
    throw agentError;
  }
}
