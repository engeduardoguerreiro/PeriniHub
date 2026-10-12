import { describe, expect, it } from "vitest";

import {
  buildWhatsAppUrl,
  ecosystemCards,
  heroStats,
  jsonLd,
  projectTypes,
  WHATSAPP_NUMBER,
  WHATSAPP_URL,
} from "./site";

function decodeText(url: string) {
  return new URL(url).searchParams.get("text");
}

describe("buildWhatsAppUrl", () => {
  it("aponta para wa.me com o número da PeriniHub", () => {
    const url = new URL(buildWhatsAppUrl("oi"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe(`/${WHATSAPP_NUMBER}`);
  });

  it("codifica acentos, quebras de linha e caracteres reservados sem perder conteúdo", () => {
    const message = "Olá! Preço & prazo?\nTipo: Painel / dashboard #1 = 100%";
    const url = buildWhatsAppUrl(message);
    expect(url).not.toMatch(/[\n &#]/);
    expect(decodeText(url)).toBe(message);
  });
});

describe("constantes de contato", () => {
  it("usa número só com dígitos, com DDI 55 (formato exigido pelo wa.me)", () => {
    expect(WHATSAPP_NUMBER).toMatch(/^55\d{10,11}$/);
  });

  it("WHATSAPP_URL é a mesma URL gerada pelo helper", () => {
    expect(WHATSAPP_URL).toBe(buildWhatsAppUrl(decodeText(WHATSAPP_URL)!));
  });

  it("não repete tipos de projeto (são usados como value do select)", () => {
    expect(new Set(projectTypes).size).toBe(projectTypes.length);
  });
});

describe("produtos", () => {
  it("todo produto em operação tem link https e os demais não têm", () => {
    for (const product of ecosystemCards) {
      if (product.status === "live") expect(product.href).toMatch(/^https:\/\//);
      else expect(product.href).toBeUndefined();
    }
  });

  it("o contador do hero acompanha os produtos em operação", () => {
    const live = ecosystemCards.filter((product) => product.status === "live").length;
    expect(heroStats.some((stat) => stat.value === String(live) && /SaaS/.test(stat.label))).toBe(true);
  });
});

describe("jsonLd", () => {
  it("escapa '<' para não fechar a tag <script> antes da hora", () => {
    const output = jsonLd({ text: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("<");
    expect(JSON.parse(output).text).toBe("</script><script>alert(1)</script>");
  });
});
