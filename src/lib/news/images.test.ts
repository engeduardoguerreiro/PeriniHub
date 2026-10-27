// @vitest-environment node
import { describe, expect, it } from "vitest";

import { prioritizedScore } from "@/agents/curator";

import { parseFeed } from "./feed-parser";
import { checkImage, extractImageCandidates, resolveUnique } from "./images";

/** Cabeçalho PNG mínimo (assinatura + IHDR) com as dimensões pedidas. */
function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

describe("checkImage (validação pelo conteúdo)", () => {
  it("aceita foto de capa típica (1200x630)", () => {
    expect(checkImage(png(1200, 630))).toMatchObject({ ok: true, type: "png", mime: "image/png", width: 1200 });
  });

  it("recusa ícones e logos pequenos", () => {
    expect(checkImage(png(64, 64))).toMatchObject({ ok: false });
    expect(checkImage(png(300, 200))).toMatchObject({ ok: false });
  });

  it("recusa proporções que não servem de capa (faixas e retratos extremos)", () => {
    expect(checkImage(png(2000, 300))).toMatchObject({ ok: false, reason: expect.stringContaining("proporção") });
    expect(checkImage(png(500, 1200))).toMatchObject({ ok: false });
  });

  it("recusa SVG (pode carregar script) e lixo", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><script>alert(1)</script></svg>');
    expect(checkImage(svg)).toMatchObject({ ok: false });
    expect(checkImage(new TextEncoder().encode("não é imagem"))).toMatchObject({ ok: false });
  });
});

describe("imagem de divulgação da página", () => {
  it("lê og:image e twitter:image, resolve caminhos relativos e remove duplicadas", () => {
    const html = `<html><head>
      <meta property="og:image" content="/img/capa.jpg">
      <meta name="twitter:image" content="https://cdn.exemplo.com/capa-tw.png">
      <meta property="og:image:secure_url" content="https://exemplo.com/img/capa.jpg">
      <meta property="og:image" content="data:image/png;base64,AAAA">
      <meta property="og:image" content="https://exemplo.com/logo.svg">
    </head></html>`;
    expect(extractImageCandidates(html, "https://exemplo.com/noticias/1")).toEqual([
      "https://exemplo.com/img/capa.jpg",
      "https://cdn.exemplo.com/capa-tw.png",
    ]);
  });

  it("ignora esquemas perigosos", () => {
    expect(resolveUnique(["javascript:alert(1)", "file:///etc/passwd", "ftp://x/y.jpg"], "https://e.com")).toEqual([]);
  });
});

describe("imagem declarada no feed", () => {
  it("usa media:content, enclosure ou a primeira <img> do conteúdo", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
      <item><title>Com media</title><link>https://e.com/a</link><media:content url="https://e.com/a.jpg" medium="image"/></item>
      <item><title>Com enclosure</title><link>https://e.com/b</link><enclosure url="https://e.com/b.png" type="image/png" length="1"/></item>
      <item><title>Com img</title><link>https://e.com/c</link><description><![CDATA[<p><img src="/c.webp"> texto</p>]]></description></item>
      <item><title>Sem imagem</title><link>https://e.com/d</link></item>
    </channel></rss>`;
    expect(parseFeed(xml).map((item) => item.imageUrl)).toEqual(["https://e.com/a.jpg", "https://e.com/b.png", "https://e.com/c.webp", null]);
  });
});

describe("prioridade editorial", () => {
  it("soma o bônus da categoria à nota da IA, sem passar de 100", () => {
    expect(prioritizedScore(70, 1)).toBe(85);
    expect(prioritizedScore(70, 2)).toBe(80);
    expect(prioritizedScore(70, 3)).toBe(75);
    expect(prioritizedScore(70, 4)).toBe(70);
    expect(prioritizedScore(95, 1)).toBe(100);
    expect(prioritizedScore(-5, undefined)).toBe(0);
  });

  it("com nota mínima 70, notícia mediana de Linux entra e a de tema secundário não", () => {
    expect(prioritizedScore(60, 1)).toBeGreaterThanOrEqual(70);
    expect(prioritizedScore(60, 4)).toBeLessThan(70);
  });
});
