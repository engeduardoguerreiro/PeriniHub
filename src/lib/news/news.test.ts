// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildNewsSitemap, buildRssFeed, escapeXml } from "./feeds";
import type { Article } from "./queries";
import { sign, verifyRevalidateRequest } from "./revalidate-signature";
import { isAllowedCoverUrl, parseOriginalSources } from "./schemas";
import { articleJsonLd, articleMetadata, pagedPath } from "./seo";
import { isValidSlug, slugify, uniqueSlug } from "./slug";

const article: Article = {
  id: "1",
  slug: "nodejs-24-entra-em-lts",
  title: "Node.js 24 entra em suporte de longo prazo",
  excerpt: "A linha 24 do Node.js passou a ser LTS.",
  coverImageUrl: null,
  coverImageAlt: null,
  publishedAt: "2026-10-27T12:00:00.000Z",
  category: { name: "Linguagens e Ferramentas", slug: "linguagens-e-ferramentas" },
  subtitle: null,
  content: "## O que aconteceu\n\nTexto.",
  coverImageCredit: null,
  categoryId: "c",
  updatedAt: "2026-10-27T12:00:00.000Z",
  originalSources: [{ title: "Node 24 LTS", url: "https://nodejs.org/en/blog/release/v24" }],
  seo: { meta_title: "Node.js 24 vira LTS", meta_description: "Resumo para buscadores.", keywords: ["node.js", "lts"] },
};

describe("slug", () => {
  it.each([
    ["Next.js 16.4: o que muda no cache?", "next-js-16-4-o-que-muda-no-cache"],
    ["Segurança & Privacidade em APIs", "seguranca-e-privacidade-em-apis"],
    ["  --Ação!!  ", "acao"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(isValidSlug(slugify(input))).toBe(true);
  });

  it("corta sem quebrar palavra e garante unicidade", () => {
    const long = slugify("palavra ".repeat(30), 40);
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("-")).toBe(false);
    expect(uniqueSlug("node-24", new Set(["node-24", "node-24-2"]))).toBe("node-24-3");
  });

  it("recusa slugs com caracteres perigosos", () => {
    for (const bad of ["../etc", "a b", "Maiuscula", "x--y", "-x", "a/b", ""]) expect(isValidSlug(bad)).toBe(false);
  });
});

describe("metadados do artigo", () => {
  it("usa meta title/description do SEO, canonical e Open Graph de artigo", () => {
    const metadata = articleMetadata(article);
    expect(metadata.title).toBe("Node.js 24 vira LTS");
    expect(metadata.description).toBe("Resumo para buscadores.");
    expect(metadata.alternates?.canonical).toBe("/tech/nodejs-24-entra-em-lts");
    expect(metadata.openGraph).toMatchObject({ type: "article", publishedTime: article.publishedAt });
  });

  it("gera JSON-LD NewsArticle e breadcrumb", () => {
    const graph = articleJsonLd(article)["@graph"];
    expect(graph[0]).toMatchObject({ "@type": "NewsArticle", datePublished: article.publishedAt, isBasedOn: [article.originalSources[0].url] });
    expect(graph[1]["@type"]).toBe("BreadcrumbList");
  });

  it("paginação: página 1 sem parâmetro", () => {
    expect(pagedPath("/tech", 1)).toBe("/tech");
    expect(pagedPath("/tech", 3)).toBe("/tech?pagina=3");
  });
});

describe("feeds", () => {
  it("escapa XML e remove caracteres de controle", () => {
    expect(escapeXml(`<a href="x">&'\u0001`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  });

  it("RSS lista os artigos com link permanente", () => {
    const rss = buildRssFeed([article]);
    expect(rss).toContain("<guid isPermaLink=\"true\">https://perinihub.com.br/tech/nodejs-24-entra-em-lts</guid>");
    expect(rss).toContain("<language>pt-BR</language>");
  });

  it("sitemap de notícias só inclui os últimos 2 dias", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const xml = buildNewsSitemap(
      [
        { slug: "recente", title: "Recente", publishedAt: "2026-10-27T12:00:00Z", updatedAt: "2026-10-27T12:00:00Z" },
        { slug: "antiga", title: "Antiga", publishedAt: "2026-10-20T12:00:00Z", updatedAt: "2026-10-20T12:00:00Z" },
      ],
      now,
    );
    expect(xml).toContain("/tech/recente");
    expect(xml).not.toContain("/tech/antiga");
  });
});

describe("dados vindos do banco", () => {
  it("descarta fontes inválidas sem quebrar a página", () => {
    expect(parseOriginalSources([{ title: "ok", url: "https://a.com" }, { title: "x", url: "javascript:alert(1)" }, "lixo"])).toHaveLength(1);
    expect(parseOriginalSources(null)).toEqual([]);
  });

  it("capa só de arquivo local ou do Storage do próprio Supabase", () => {
    const supabase = "https://abc.supabase.co";
    expect(isAllowedCoverUrl("/capas/x.png", supabase)).toBe(true);
    expect(isAllowedCoverUrl(`${supabase}/storage/v1/object/public/capas/x.png`, supabase)).toBe(true);
    expect(isAllowedCoverUrl("https://outro.com/x.png", supabase)).toBe(false);
    expect(isAllowedCoverUrl("//evil.com/x.png", supabase)).toBe(false);
  });
});

describe("revalidação assinada (worker → site)", () => {
  const secret = "a".repeat(64);
  const now = Date.parse("2026-10-27T12:00:00Z");
  const body = (data: object) => JSON.stringify(data);

  it("aceita corpo assinado e recente", () => {
    const raw = body({ tags: ["news:list", "news:article:node-24"], ts: now });
    expect(verifyRevalidateRequest(raw, sign(raw, secret), secret, now)).toMatchObject({ ok: true });
  });

  it("recusa assinatura errada, corpo adulterado e replay antigo", () => {
    const raw = body({ tags: ["news:list"], ts: now });
    expect(verifyRevalidateRequest(raw, sign(raw, "b".repeat(64)), secret, now)).toMatchObject({ ok: false, status: 401 });
    expect(verifyRevalidateRequest(raw.replace("list", "categories"), sign(raw, secret), secret, now)).toMatchObject({ ok: false, status: 401 });
    expect(verifyRevalidateRequest(raw, sign(raw, secret), secret, now + 10 * 60 * 1000)).toMatchObject({ ok: false, reason: "requisição expirada" });
    expect(verifyRevalidateRequest(raw, null, secret, now)).toMatchObject({ ok: false, status: 401 });
  });

  it("só aceita tags do portal", () => {
    const raw = body({ tags: ["qualquer-coisa"], ts: now });
    expect(verifyRevalidateRequest(raw, sign(raw, secret), secret, now)).toMatchObject({ ok: false, status: 400 });
  });
});
