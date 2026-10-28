import { z } from "zod";

// Saídas estruturadas dos agentes. O modelo só PROPÕE; o código valida com
// estes schemas e decide o que aplicar (docs/ai-sales/SECURITY.md §7).

export const sdrOutput = z.object({
  reply: z.string().max(1500).describe("Resposta ao cliente, em português, curta e cordial. Vazia se for transferir."),
  confidence: z.number().min(0).max(1).describe("Confiança de que a resposta está correta e completa (0 a 1)."),
  intent: z.enum(["greeting", "question", "pricing", "purchase_interest", "support", "complaint", "opt_out", "other"]),
  handoff: z.object({ needed: z.boolean(), reason: z.string().max(300) }),
  cited_chunk_ids: z.array(z.string()).max(5).describe("Ids dos trechos da base de conhecimento usados na resposta."),
  lead_update: z.object({
    qualification: z.enum(["unknown", "cold", "warm", "hot"]).nullable(),
    score: z.number().int().min(0).max(100).nullable(),
    note: z.string().max(500).nullable(),
  }),
});
export type SdrOutput = z.infer<typeof sdrOutput>;

export const captureOutput = z.object({
  qualification: z.enum(["unknown", "cold", "warm", "hot"]),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().max(200)).max(5),
  missing_info: z.array(z.string().max(120)).max(5),
});
export type CaptureOutput = z.infer<typeof captureOutput>;

export const followupOutput = z.object({
  recommendations: z
    .array(
      z.object({
        lead_id: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        action: z.string().max(200),
        message_suggestion: z.string().max(500).nullable(),
      }),
    )
    .max(20),
});
export type FollowupOutput = z.infer<typeof followupOutput>;

export const analystOutput = z.object({
  summary: z.string().max(1500),
  insights: z.array(z.string().max(300)).max(6),
  recommendations: z.array(z.string().max(300)).max(5),
});
export type AnalystOutput = z.infer<typeof analystOutput>;
