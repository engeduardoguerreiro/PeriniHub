/**
 * Erros dos agentes. `retryable` orienta o Trigger.dev: falhas transitórias
 * (rede, 429, 5xx) tentam de novo com backoff; o resto vai direto para
 * revisão humana / dead letter, sem gastar mais orçamento.
 */
export class AgentError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    /** Tokens já cobrados quando o provedor respondeu, mas a resposta foi rejeitada. */
    readonly usage?: { input: number; output: number; cacheRead: number; cacheWrite: number },
  ) {
    super(message);
    this.name = "AgentError";
  }
}

/** Mensagens das funções do banco (raise exception) que não devem ser repetidas. */
const DB_STOP_CODES = ["budget_exceeded", "automation_paused", "duplicate_run", "not_authorized"] as const;
export type DbStopCode = (typeof DB_STOP_CODES)[number];

export function dbStopCode(message: string | undefined): DbStopCode | null {
  if (!message) return null;
  return DB_STOP_CODES.find((code) => message.includes(code)) ?? null;
}
