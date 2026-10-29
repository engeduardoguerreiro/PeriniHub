// Rótulos do ciclo de vida das campanhas.

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "disabled" },
  awaiting_approval: { label: "Aguardando aprovação", tone: "pending" },
  scheduled: { label: "Agendada", tone: "pending" },
  running: { label: "Em execução", tone: "active" },
  paused: { label: "Pausada", tone: "suspended" },
  completed: { label: "Concluída", tone: "closed" },
  canceled: { label: "Cancelada", tone: "closed" },
};

export const RECIPIENT_STATUS: Record<string, string> = {
  pending: "na fila",
  processing: "enviando",
  sent: "enviada",
  blocked: "bloqueada pelo gate",
  failed: "falhou",
  skipped: "não enviada",
};

/** Estimativa de custo por mensagem (R$), referência de terceiros — conferir na tabela da Meta. */
export const ESTIMATED_COST_BRL: Record<string, number> = { marketing: 0.4, utility: 0.08, authentication: 0.09 };
