// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/site";

import { metadata as clientesMetadata } from "./clientes/page";
import { metadata as homeMetadata } from "./page";
import robots from "./robots";
import sitemap from "./sitemap";

describe("SEO", () => {
  it("SITE_URL é o domínio canônico, em https e sem barra final", () => {
    expect(SITE_URL).toBe("https://perinihub.com.br");
  });

  it("sitemap lista exatamente as duas páginas públicas, com lastModified", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([SITE_URL, `${SITE_URL}/clientes`]);
    for (const entry of entries) expect(entry.lastModified).toBeInstanceOf(Date);
  });

  it("robots libera o site, bloqueia painel e APIs e aponta o sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
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
