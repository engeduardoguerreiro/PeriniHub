import { jaccard } from "@/lib/news/text";

// Deduplicação determinística (sem IA). Limiares calibrados para não juntar
// eventos diferentes do mesmo produto: "Node 24 vira LTS" e "Node corrige
// falha de segurança" compartilham poucas palavras significativas.
export const DUPLICATE_THRESHOLD = 0.6;
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.35;

export type DedupeCandidate = {
  id: string;
  fingerprint: string;
  titleTokens: string[];
  fetchedAt: string;
  trustRank: number;
};

export type DedupeMatch =
  | { kind: "fingerprint" | "similar"; of: string; score: number }
  | { kind: "possible"; of: string; score: number }
  | null;

/**
 * Procura o candidato "original" de que este é cópia. O pool deve conter
 * candidatos anteriores ainda válidos (não descartados nem duplicados).
 */
export function findDuplicate(candidate: DedupeCandidate, pool: readonly DedupeCandidate[]): DedupeMatch {
  let best: DedupeMatch = null;
  for (const other of pool) {
    if (other.id === candidate.id) continue;
    if (other.fingerprint === candidate.fingerprint) return { kind: "fingerprint", of: other.id, score: 1 };
    const score = jaccard(candidate.titleTokens, other.titleTokens);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { kind: "similar", of: other.id, score };
    else if (score >= POSSIBLE_DUPLICATE_THRESHOLD && (!best || (best.kind === "possible" && score > best.score))) {
      best = { kind: "possible", of: other.id, score };
    }
  }
  return best;
}

/**
 * Ordem de preferência para manter o "principal" de um grupo: fonte mais
 * confiável primeiro, depois a mais antiga (quem noticiou antes).
 */
export function preferredOrder(a: DedupeCandidate, b: DedupeCandidate) {
  return a.trustRank - b.trustRank || a.fetchedAt.localeCompare(b.fetchedAt) || a.id.localeCompare(b.id);
}

export const TRUST_RANK = { official: 0, high: 1, medium: 2, low: 3 } as const;
