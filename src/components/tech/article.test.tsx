import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ArticleCard as ArticleCardData } from "@/lib/news/queries";

import { ArticleBody, safeHref } from "./article-body";
import { ArticleCard } from "./article-card";

const card: ArticleCardData = {
  id: "1",
  slug: "nodejs-24-entra-em-lts",
  title: "Node.js 24 entra em suporte de longo prazo",
  excerpt: "A linha 24 do Node.js passou a ser LTS.",
  coverImageUrl: null,
  coverImageAlt: null,
  publishedAt: "2026-10-27T12:00:00.000Z",
  category: { name: "Linguagens e Ferramentas", slug: "linguagens-e-ferramentas" },
};

describe("renderização de artigo publicado", () => {
  it("card mostra título como link, categoria e data no fuso de Brasília", () => {
    render(<ArticleCard article={card} />);
    const link = screen.getByRole("link", { name: card.title });
    expect(link).toHaveAttribute("href", "/tech/nodejs-24-entra-em-lts");
    expect(screen.getByText("Linguagens e Ferramentas")).toBeInTheDocument();
    expect(screen.getByText("27 de outubro de 2026")).toHaveAttribute("datetime", card.publishedAt);
  });

  it("corpo em Markdown vira HTML semântico (h2, listas, código)", () => {
    const { container } = render(<ArticleBody markdown={"## O que aconteceu\n\nTexto com `npm i`.\n\n- um\n- dois"} />);
    expect(screen.getByRole("heading", { level: 2, name: "O que aconteceu" })).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("code")?.textContent).toBe("npm i");
  });
});

describe("saneamento do conteúdo gerado", () => {
  const hostile = [
    "<script>alert('x')</script>",
    '<img src=x onerror="alert(1)">',
    "<iframe src='https://evil.com'></iframe>",
    "[clique](javascript:alert(1))",
    "[dados](data:text/html;base64,PHNjcmlwdD4=)",
    "![img](https://evil.com/tracker.png)",
    "# Título h1 duplicado",
    "[externo](https://example.com/fonte)",
    "[interno](/tech)",
  ].join("\n\n");

  it("não renderiza HTML cru, scripts, iframes, imagens nem h1", () => {
    const { container } = render(<ArticleBody markdown={hostile} />);
    expect(container.querySelector("script, iframe, img, h1")).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|javascript:|data:text/);
  });

  it("links externos abrem em nova aba com nofollow; internos são relativos", () => {
    render(<ArticleBody markdown={hostile} />);
    expect(screen.getByRole("link", { name: /externo/ })).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "interno" })).toHaveAttribute("href", "/tech");
    expect(screen.queryByRole("link", { name: "clique" })).toBeNull();
  });

  it("safeHref só aceita http(s) e caminhos internos", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("https://perinihub.com.br/tech/x")).toEqual({ href: "/tech/x", external: false });
  });
});
