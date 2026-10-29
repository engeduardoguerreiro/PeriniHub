import { describe, expect, it } from "vitest";

import { inSendWindow, renderParameters } from "./params";

describe("variáveis do template", () => {
  it("troca {{nome}} pelo primeiro nome e {{empresa}} pela empresa", () => {
    expect(renderParameters(["{{nome}}", "Olá {{ NOME }} da {{empresa}}", "fixo"], { full_name: "Ana Maria Souza", company: { name: "Acme" } })).toEqual(["Ana", "Olá Ana da Acme", "fixo"]);
    expect(renderParameters("não é lista", { full_name: "X" })).toEqual([]);
  });
});

describe("janela de envio", () => {
  it("usa o fuso da empresa e o fim é exclusivo", () => {
    const noonSaoPaulo = Date.parse("2026-11-02T15:00:00Z");
    expect(inSendWindow("09:00", "18:00", "America/Sao_Paulo", noonSaoPaulo)).toBe(true);
    expect(inSendWindow("09:00", "12:00", "America/Sao_Paulo", noonSaoPaulo)).toBe(false);
    expect(inSendWindow("09:00", "18:00", "America/Sao_Paulo", Date.parse("2026-11-02T23:30:00Z"))).toBe(false);
  });
});
