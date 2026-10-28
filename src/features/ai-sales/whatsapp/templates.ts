// Texto do corpo de um template (componente BODY), para exibir e contar variáveis.
export function templateBody(components: unknown) {
  if (!Array.isArray(components)) return "";
  const body = components.find((item) => typeof item === "object" && item !== null && (item as { type?: string }).type?.toUpperCase() === "BODY") as { text?: string } | undefined;
  return body?.text ?? "";
}

/** Janela de atendimento de 24 h a partir da última mensagem recebida do contato. */
export function inServiceWindow(lastInboundAt: string | null, now = Date.now()) {
  return Boolean(lastInboundAt) && now - new Date(lastInboundAt!).getTime() < 24 * 3600 * 1000;
}
