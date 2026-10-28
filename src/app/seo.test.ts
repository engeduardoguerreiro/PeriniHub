// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { SITE_URL } from "@/lib/site";

vi.mock("@/lib/news/queries", () => ({
  getCategories: async () => [{ id: "c1", name: "Segurança", slug: "seguranca", description: null }],
  getPublishedEntries: async () => [
    { slug: "node-24-lts", title: "Node 24 LTS", publishedAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T12:00:00Z" },
  ],
}));

import { metadata as clientesMetadata } from "./clientes/page";
import { metadata as homeMetadata } from "./page";
import robots from "./robots";
import sitemap from "./sitemap";

describe("SEO", () => {
  it("SITE_URL é o domínio canônico, em https e sem barra final", () => {
    expect(SITE_URL).toBe("https://perinihub.com.br");
  });

  it("sitemap lista páginas institucionais, portal e artigos publicados", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      SITE_URL,
      `${SITE_URL}/clientes`,
      `${SITE_URL}/tech`,
      `${SITE_URL}/tech/node-24-lts`,
    ]);
    for (const entry of entries) expect(entry.lastModified).toBeInstanceOf(Date);
    expect(entries.at(-1)?.lastModified).toEqual(new Date("2026-10-20T12:00:00Z"));
  });

  it("robots libera o site, bloqueia painel e APIs e aponta o sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] });
    expect(result.sitemap).toEqual([`${SITE_URL}/sitemap.xml`, `${SITE_URL}/tech/news-sitemap.xml`]);
  });

  it("home declara canonical e og:url próprios", () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(homeMetadata.openGraph?.url).toBe("/");
  });

  it("/clientes tem título, descrição, canonical e Open Graph próprios", () => {
    expect(clientesMetadata.title).toBe("Clientes e projetos entregues");
    expect(clientesMetadata.description).toBeTruthy();
    expect(clientesMetadata.alternates?.canonical).toBe("/clientes");
    expect(clientesMetadata.openGraph?.url).toBe("/clientes");
    expect(clientesMetadata.openGraph?.title).toContain("Clientes");
  });
});
