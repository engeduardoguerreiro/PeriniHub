// @vitest-environment node
import { describe, expect, it } from "vitest";

import { titleFingerprint, titleTokens } from "@/lib/news/text";
import { dueCollectionSlots, writingCapacity } from "@/trigger/schedule";

import { findDuplicate, preferredOrder, type DedupeCandidate } from "./dedupe";
import { unmatchedNumbers, validateClaims, verdictFor, type CheckedClaim, type EvidenceDoc } from "./fact-checker";
import { safeMetaTitle } from "./seo-editor";
import { localTime, localWeekday, startOf } from "./types";
import { buildMarkdown, normalizeWritten, verbatimOverlap, type WrittenArticle } from "./writer";

function candidate(id: string, title: string, overrides: Partial<DedupeCandidate> = {}): DedupeCandidate {
  return { id, fingerprint: titleFingerprint(title), titleTokens: titleTokens(title), fetchedAt: "2026-10-27T10:00:00Z", trustRank: 0, ...overrides };
}

describe("deduplicação por similaridade", () => {
  const pool = [
    candidate("a", "Next.js 16.4 released with Turbopack improvements"),
    candidate("b", "PostgreSQL 18.1 security update fixes CVE-2026-1234"),
  ];

  it("mesmo título em outra URL é duplicado por fingerprint", () => {
    expect(findDuplicate(candidate("c", "NEXT.JS 16.4 RELEASED WITH TURBOPACK IMPROVEMENTS!"), pool)).toMatchObject({ kind: "fingerprint", of: "a" });
  });

  it("título muito parecido é duplicado por similaridade", () => {
    const match = findDuplicate(candidate("c", "Next.js 16.4 released, bringing faster Turbopack builds and improvements"), pool);
    expect(match).toMatchObject({ kind: "similar", of: "a" });
  });

  it("evento diferente do mesmo produto não é duplicado", () => {
    const match = findDuplicate(candidate("c", "Next.js conference 2026 announces keynote speakers"), pool);
    expect(match === null || match.kind === "possible").toBe(true);
  });

  it("assunto sem relação não tem match", () => {
    expect(findDuplicate(candidate("c", "Rust 2.0 roadmap published"), pool)).toBeNull();
  });

  it("preferência: fonte mais confiável e, depois, a mais antiga", () => {
    const official = candidate("x", "t", { trustRank: 0, fetchedAt: "2026-10-27T12:00:00Z" });
    const blog = candidate("y", "t", { trustRank: 2, fetchedAt: "2026-10-27T08:00:00Z" });
    expect([blog, official].sort(preferredOrder).map((c) => c.id)).toEqual(["x", "y"]);
  });
});

describe("Fact Checker: notícia sem evidência não passa", () => {
  const docs: EvidenceDoc[] = [
    { id: "fonte-principal", url: "https://nodejs.org/en/blog/release/v24", host: "nodejs.org", text: "Node.js 24 is now LTS. It ships the permission model as stable.", independent: false },
    { id: "fonte-2", url: "https://example.org/node", host: "example.org", text: "The Node.js 24 line entered Long Term Support this week.", independent: true },
  ];

  it("mantém só citações que existem literalmente no documento", () => {
    const [claim] = validateClaims(
      [
        {
          claim: "Node.js 24 virou LTS",
          status: "supported",
          confidence: 0.9,
          notes: "",
          evidence: [
            { doc_id: "fonte-principal", quote: "Node.js 24 is now LTS" },
            { doc_id: "fonte-2", quote: "inventado pelo modelo e inexistente" },
          ],
        },
      ],
      docs,
    );
    expect(claim.status).toBe("supported");
    expect(claim.evidence).toHaveLength(1);
    expect(claim.evidence[0].docId).toBe("fonte-principal");
  });

  it("afirmação 'supported' sem trecho real é rebaixada (a IA sozinha não verifica)", () => {
    const [claim] = validateClaims(
      [{ claim: "Node 24 é 3x mais rápido", status: "supported", confidence: 1, notes: "", evidence: [{ doc_id: "fonte-principal", quote: "three times faster than before" }] }],
      docs,
    );
    expect(claim.status).toBe("unsupported");
  });

  it("evidência de outro domínio conta como independente", () => {
    const [claim] = validateClaims(
      [{ claim: "Entrou em LTS", status: "supported", confidence: 0.8, notes: "", evidence: [{ doc_id: "fonte-2", quote: "entered Long Term Support" }] }],
      docs,
    );
    expect(claim.evidence[0].independent).toBe(true);
  });

  it("sem afirmações verificadas, o artigo é bloqueado", () => {
    expect(verdictFor([], [])).toBe("blocked");
  });

  it("qualquer afirmação sem suporte bloqueia; parciais vão para revisão", () => {
    const ok: CheckedClaim = { claim: "a", status: "supported", confidence: 1, notes: "", evidence: [] };
    expect(verdictFor([ok], [])).toBe("verified");
    expect(verdictFor([ok, { ...ok, status: "partially_supported" }], [])).toBe("partially_verified");
    expect(verdictFor([ok, { ...ok, status: "unsupported" }], [])).toBe("blocked");
    expect(verdictFor([ok, { ...ok, status: "contradicted" }], [])).toBe("blocked");
  });

  it("números no formato brasileiro casam com o formato da fonte", () => {
    expect(unmatchedNumbers("Foram 681.280 requisições e 1.048.576 tokens", "681,280 requests and 1048576 tokens")).toEqual([]);
    expect(unmatchedNumbers("Foram 999.999 requisições", "681,280 requests")).toEqual(["999.999"]);
  });

  it("versão ou ano citado no texto e ausente nas fontes bloqueia", () => {
    const missing = unmatchedNumbers("Node.js 24.1 chega em 2027 com v8 12.4", "Node.js 24.1 release with V8 12.4");
    expect(missing).toEqual(["2027"]);
    expect(verdictFor([{ claim: "a", status: "supported", confidence: 1, notes: "", evidence: [] }], missing)).toBe("blocked");
  });
});

describe("Writer", () => {
  const written: WrittenArticle = {
    title: "Node.js 24 entra em suporte de longo prazo!!",
    subtitle: "Versão traz modelo de permissões estável",
    excerpt: "A linha 24 do Node.js passou a ser LTS, segundo o anúncio oficial do projeto.",
    what_happened: "A equipe do Node.js anunciou que a versão 24 passou ao status LTS. Veja [aqui](https://evil.example) e <script>x()</script>.",
    highlights: ["Modelo de permissões estável", "ok"],
    technical_context: "",
    impact: "Quem usa Node em produção pode planejar a migração com suporte estendido.",
    caveats: [],
  };

  it("remove links, HTML e títulos que o modelo coloque no texto", () => {
    const markdown = buildMarkdown(normalizeWritten(written));
    expect(markdown).not.toMatch(/evil\.example|<script|\]\(/);
    expect(markdown).toContain("## O que aconteceu");
    expect(markdown).not.toContain("## Contexto técnico"); // seção vazia some
  });

  it("normaliza título (sem exclamações) e recusa texto incompleto", () => {
    expect(normalizeWritten(written).title).toBe("Node.js 24 entra em suporte de longo prazo");
    expect(() => normalizeWritten({ ...written, what_happened: "curto" })).toThrow("incompleto");
  });

  it("detecta cópia literal da fonte", () => {
    const source = "the quick brown fox jumps over the lazy dog near the river bank today and tomorrow as well";
    expect(verbatimOverlap(source, source)).toBeGreaterThan(0.9);
    expect(verbatimOverlap("um texto totalmente diferente escrito em português sobre outro assunto qualquer mesmo", source)).toBe(0);
  });
});

describe("SEO Editor", () => {
  it("recusa títulos sensacionalistas e usa o título editorial", () => {
    expect(safeMetaTitle("INACREDITÁVEL: Node 24 chegou!", "Node.js 24 entra em LTS")).toBe("Node.js 24 entra em LTS");
    expect(safeMetaTitle("Node.js 24 entra em suporte de longo prazo", "x")).toBe("Node.js 24 entra em suporte de longo prazo");
  });
});

describe("agendador", () => {
  // 2026-10-27 09:05 UTC = 06:05 em São Paulo (UTC-3)
  const at0605 = Date.parse("2026-10-27T09:05:00Z");

  it("dispara o horário que caiu na janela de 15 minutos, com chave por dia", () => {
    expect(dueCollectionSlots(["06:00", "12:00", "17:00"], "America/Sao_Paulo", at0605)).toEqual([
      { time: "06:00", key: "collect:2026-10-27:06:00" },
    ]);
  });

  it("só dispara nos dias da semana configurados", () => {
    // 2026-10-27 é terça (2).
    expect(dueCollectionSlots(["06:00"], "America/Sao_Paulo", at0605, [1])).toEqual([]);
    expect(dueCollectionSlots(["06:00"], "America/Sao_Paulo", at0605, [2])).toHaveLength(1);
    // 02:00 UTC de terça ainda é segunda em São Paulo.
    expect(localWeekday("America/Sao_Paulo", Date.parse("2026-10-27T02:00:00Z"))).toBe(1);
  });

  it("não dispara fora da janela", () => {
    expect(dueCollectionSlots(["06:00"], "America/Sao_Paulo", Date.parse("2026-10-27T09:20:00Z"))).toEqual([]);
    expect(dueCollectionSlots(["06:00"], "America/Sao_Paulo", Date.parse("2026-10-27T08:59:00Z"))).toEqual([]);
  });

  it("calcula início do dia e hora local no fuso editorial", () => {
    expect(localTime("America/Sao_Paulo", at0605)).toBe("06:05");
    expect(startOf("day", "America/Sao_Paulo", Date.parse("2026-10-27T02:00:00Z"))).toBe("2026-10-26T03:00:00.000Z");
    expect(startOf("month", "America/Sao_Paulo", at0605)).toBe("2026-10-01T03:00:00.000Z");
  });

  it("capacidade de redação respeita o limite diário (controle de consumo)", () => {
    expect(writingCapacity(3, 0)).toBe(3);
    expect(writingCapacity(3, 2)).toBe(1);
    expect(writingCapacity(3, 3)).toBe(0);
    expect(writingCapacity(3, 9)).toBe(0);
    expect(writingCapacity(0, 0)).toBe(0);
  });
});
