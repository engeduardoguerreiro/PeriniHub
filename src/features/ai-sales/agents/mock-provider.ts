import type { LlmProvider, LlmRequest, LlmResult } from "@/lib/ai/provider";

import type { AgentType } from "./presets";

// Provedor simulado: respostas determinísticas, sem custo e sem rede. Usado
// no "modo de teste" dos agentes e nos testes automáticos. Segue as mesmas
// regras que exigimos do modelo real (cita trechos, transfere sem fonte).

const CHUNK_ID = /<documento_externo id="(chunk:[0-9a-f-]{36})"/g;

function lastCustomerMessage(prompt: string) {
  const matches = [...prompt.matchAll(/Cliente: ([^\n]+)/g)];
  return matches.at(-1)?.[1] ?? "";
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  constructor(private readonly type: AgentType) {}

  async generate<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    const chunks = [...request.prompt.matchAll(CHUNK_ID)].map((match) => match[1].replace("chunk:", ""));
    let data: unknown;
    if (this.type === "sdr") {
      const text = lastCustomerMessage(request.prompt).toLowerCase();
      const pricing = /(pre[çc]o|valor|quanto custa|or[çc]amento)/.test(text);
      const injection = /(ignore|instru[çc][õo]es|system prompt|senha)/.test(text);
      const handoff = injection || (pricing && chunks.length === 0);
      data = {
        reply: handoff ? "" : `Obrigado pela mensagem! ${chunks.length ? "Segundo nossas informações, posso te ajudar com isso." : "Pode me contar um pouco mais sobre o que você precisa?"}`,
        confidence: handoff ? 0.3 : 0.85,
        intent: pricing ? "pricing" : "question",
        handoff: { needed: handoff, reason: handoff ? (injection ? "Mensagem fora do escopo do atendimento" : "Pergunta de preço sem informação na base") : "" },
        cited_chunk_ids: handoff ? [] : chunks.slice(0, 1),
        lead_update: { qualification: pricing ? "warm" : null, score: pricing ? 60 : null, note: null },
      };
    } else if (this.type === "capture") {
      data = { qualification: "warm", score: 55, reasons: ["Dados de contato completos"], missing_info: ["Porte da empresa"] };
    } else if (this.type === "followup") {
      const ids = [...request.prompt.matchAll(/lead_id=([0-9a-f-]{36})/g)].map((match) => match[1]);
      data = { recommendations: ids.slice(0, 20).map((id) => ({ lead_id: id, priority: "medium", action: "Retomar contato perguntando se ainda há interesse", message_suggestion: null })) };
    } else {
      data = { summary: "Resumo gerado em modo de teste a partir dos indicadores recebidos.", insights: ["Modo de teste: sem análise real."], recommendations: [] };
    }
    return { data: request.schema.parse(data), model: "mock", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  }
}
