import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { requireSecret } from "@/lib/env";

import { AgentError } from "./errors";

// Abstração de provedor: os agentes pedem "gere um objeto com este schema" e
// não sabem qual fornecedor responde. Hoje há só Anthropic; outro provedor
// entra implementando LlmProvider e registrando em createProvider.

export type Effort = "low" | "medium" | "high";

export type LlmRequest<T> = {
  model: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
  effort: Effort;
};

export type LlmUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type LlmResult<T> = { data: T; usage: LlmUsage; model: string };

export interface LlmProvider {
  readonly name: string;
  generate<T>(request: LlmRequest<T>): Promise<LlmResult<T>>;
}

/** Qual chave usar: a do portal Tech ou a do AI Sales (orçamentos separados, D-04). */
export type ApiKeyEnv = "ANTHROPIC_API_KEY" | "AI_SALES_ANTHROPIC_API_KEY";

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  constructor(private readonly apiKeyEnv: ApiKeyEnv = "ANTHROPIC_API_KEY") {}

  private getClient() {
    // Retries de rede/429/5xx ficam com o SDK (2) e, acima dele, com o Trigger.dev.
    this.client ??= new Anthropic({ apiKey: requireSecret(this.apiKeyEnv), timeout: 180_000 });
    return this.client;
  }

  async generate<T>({ model, system, prompt, schema, maxOutputTokens, effort }: LlmRequest<T>): Promise<LlmResult<T>> {
    let response;
    try {
      response = await this.getClient().messages.parse({
        model,
        max_tokens: maxOutputTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(schema), effort },
      });
    } catch (error) {
      throw classifyAnthropicError(error);
    }

    const usage: LlmUsage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    };

    // Recusa ou corte por limite: não adianta repetir a mesma chamada.
    if (response.stop_reason === "refusal") {
      throw new AgentError(`Modelo recusou (${response.stop_details?.category ?? "sem categoria"})`, "refusal", false, usage);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AgentError("Resposta cortada pelo limite de tokens", "max_tokens", false, usage);
    }
    if (response.parsed_output == null) {
      throw new AgentError("Resposta fora do schema esperado", "invalid_output", false, usage);
    }

    return { data: response.parsed_output as T, model: response.model, usage };
  }
}

function classifyAnthropicError(error: unknown): AgentError {
  if (error instanceof Anthropic.RateLimitError) return new AgentError("Limite de requisições da API", "rate_limited", true);
  if (error instanceof Anthropic.InternalServerError) return new AgentError(`Erro do provedor (${error.status})`, "provider_5xx", true);
  if (error instanceof Anthropic.APIConnectionError) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}${error.cause.cause instanceof Error ? ` (${error.cause.cause.message})` : ""}` : "";
    return new AgentError(`Falha de conexão com o provedor${cause}`, "connection", true);
  }
  if (error instanceof Anthropic.AuthenticationError) return new AgentError("Chave da API inválida", "auth", false);
  if (error instanceof Anthropic.PermissionDeniedError) return new AgentError("Sem permissão no provedor (limite de gasto?)", "permission", false);
  if (error instanceof Anthropic.BadRequestError) return new AgentError(`Requisição inválida: ${error.message}`, "bad_request", false);
  if (error instanceof Anthropic.APIError) return new AgentError(`Erro da API (${error.status})`, "api_error", (error.status ?? 500) >= 500);
  return new AgentError(error instanceof Error ? error.message : "Erro desconhecido", "unknown", true);
}

const providers = new Map<string, LlmProvider>();

export function createProvider(name: string, apiKeyEnv: ApiKeyEnv = "ANTHROPIC_API_KEY"): LlmProvider {
  const cacheKey = `${name}:${apiKeyEnv}`;
  const existing = providers.get(cacheKey);
  if (existing) return existing;
  let provider: LlmProvider;
  switch (name) {
    case "anthropic":
      provider = new AnthropicProvider(apiKeyEnv);
      break;
    default:
      throw new AgentError(`Provedor de IA não suportado: ${name}`, "unsupported_provider", false);
  }
  providers.set(cacheKey, provider);
  return provider;
}
