// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseFeed } from "./feed-parser";
import { canonicalizeUrl, htmlToText, jaccard, parseFeedDate, titleFingerprint, titleTokens } from "./text";

const NOW = Date.parse("2026-10-27T12:00:00Z");

describe("canonicalizeUrl (deduplicação por URL)", () => {
  it("remove rastreamento, fragmento, www, barra final e ordena parâmetros", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/blog/post/?utm_source=x&b=2&a=1&fbclid=y#topo")).toBe(
      "https://example.com/blog/post?a=1&b=2",
    );
  });

  it("variações da mesma URL viram a mesma chave", () => {
    const a = canonicalizeUrl("https://example.com/post?utm_campaign=rss");
    const b = canonicalizeUrl("https://www.example.com:443/post/");
    expect(a).toBe(b);
  });

  it("recusa protocolos que não são http(s) e URLs inválidas", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("nada")).toBeNull();
  });
});

describe("similaridade de títulos", () => {
  it("mesmo título com pontuação e caixa diferentes tem o mesmo fingerprint", () => {
    expect(titleFingerprint("Next.js 16.4 is out!")).toBe(titleFingerprint("NEXT.JS 16.4 IS OUT"));
  });

  it("títulos sobre o mesmo evento têm similaridade alta", () => {
    const a = titleTokens("Node.js 24 becomes LTS with new permission model");
    const b = titleTokens("Node.js 24 is now LTS: permission model and more");
    expect(jaccard(a, b)).toBeGreaterThanOrEqual(0.5);
  });

  it("eventos diferentes do mesmo produto não se confundem", () => {
    const a = titleTokens("Node.js 24 becomes LTS");
    const b = titleTokens("Node.js security release fixes HTTP/2 vulnerability");
    expect(jaccard(a, b)).toBeLessThan(0.35);
  });
});

describe("parseFeedDate (datas inválidas)", () => {
  it.each([
    [undefined, null],
    ["", null],
    ["ontem", null],
    ["2099-01-01T00:00:00Z", null], // futuro
    ["1990-01-01T00:00:00Z", null], // antiga demais
    ["Mon, 27 Oct 2026 09:30:00 GMT", "2026-10-27T09:30:00.000Z"],
    ["2026-10-26T15:00:00-03:00", "2026-10-26T18:00:00.000Z"],
  ])("%s → %s", (input, expected) => {
    expect(parseFeedDate(input, NOW)).toBe(expected);
  });
});

describe("htmlToText", () => {
  it("descarta scripts, estilos e navegação e prefere <article>", () => {
    const html = `<html><body><nav>Menu</nav><script>alert(1)</script><article><h1>Título</h1><p>Primeiro &amp; único.</p><style>p{}</style></article><footer>Rodapé</footer></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Título");
    expect(text).toContain("Primeiro & único.");
    expect(text).not.toMatch(/alert|Menu|Rodapé|p\{\}/);
  });

  it("respeita o limite de tamanho", () => {
    expect(htmlToText(`<p>${"a".repeat(5000)}</p>`, 100)).toHaveLength(101);
  });
});

describe("parseFeed", () => {
  it("lê RSS 2.0 e limpa HTML do resumo", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>X</title>
      <item><title>Release &amp; notes</title><link>https://example.com/a?utm_source=rss</link>
      <pubDate>Mon, 27 Oct 2026 09:30:00 GMT</pubDate><description><![CDATA[<p>Resumo <b>em</b> HTML</p><script>x()</script>]]></description></item>
      <item><title>Sem link</title></item>
      <item><title>Data ruim</title><link>https://example.com/b</link><pubDate>quando der</pubDate></item>
    </channel></rss>`;
    const items = parseFeed(xml, NOW);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Release & notes",
      link: "https://example.com/a?utm_source=rss",
      publishedAt: "2026-10-27T09:30:00.000Z",
      summary: "Resumo em HTML",
    });
    expect(items[1].publishedAt).toBeNull();
  });

  it("lê Atom usando o link alternate", () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Y</title>
      <entry><title type="html">Atom &lt;b&gt;post&lt;/b&gt;</title>
      <link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/post"/>
      <published>2026-10-26T10:00:00Z</published><summary>Resumo</summary></entry></feed>`;
    const [item] = parseFeed(xml, NOW);
    expect(item).toMatchObject({ title: "Atom post", link: "https://example.com/post", publishedAt: "2026-10-26T10:00:00.000Z" });
  });

  it("recusa documentos que não são feed", () => {
    expect(() => parseFeed("<html><body>oi</body></html>", NOW)).toThrow("Formato de feed não reconhecido");
  });

  it("não expande entidades declaradas no DOCTYPE (billion laughs)", () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">${Array.from({ length: 9 }, (_, i) => `<!ENTITY lol${i + 1} "${`&lol${i === 0 ? "" : i};`.repeat(10)}">`).join("")}]><rss><channel><item><title>&lol9;</title><link>https://e.com/x</link></item></channel></rss>`;
    const [item] = parseFeed(bomb, NOW);
    expect(item.title.length).toBeLessThan(100);
  });
});
