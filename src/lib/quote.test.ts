import { describe, expect, it } from "vitest";

import { buildQuoteMessage, MESSAGE_MAX_LENGTH, type QuoteInput, validateQuote } from "./quote";

const complete: QuoteInput = {
  name: "Maria Silva",
  company: "Padaria Central",
  whatsapp: "(11) 98888-7777",
  projectType: "Site institucional",
  message: "Preciso de um site com cardápio.",
};

describe("validateQuote", () => {
  it("não aponta nada quando os obrigatórios estão preenchidos", () => {
    expect(validateQuote(complete)).toEqual([]);
  });

  it("trata campos só com espaços como vazios", () => {
    expect(validateQuote({ ...complete, name: "   ", message: "\n\t" })).toEqual([
      "name",
      "message",
    ]);
  });

  it("devolve os pendentes na ordem visual do formulário", () => {
    const empty: QuoteInput = { name: "", company: "", whatsapp: "", projectType: "", message: "" };
    expect(validateQuote(empty)).toEqual(["name", "whatsapp", "projectType", "message"]);
  });

  it("não exige empresa", () => {
    expect(validateQuote({ ...complete, company: "" })).toEqual([]);
  });

  it.each([
    ["11999990000", true],
    ["(11) 3333-4444", true],
    ["+55 11 98888-7777", true],
    ["9999-0000", false],
    ["abc", false],
    ["1".repeat(14), false],
  ])("valida o WhatsApp %s com DDD (válido: %s)", (whatsapp, valid) => {
    expect(validateQuote({ ...complete, whatsapp }).includes("whatsapp")).toBe(!valid);
  });
});

describe("buildQuoteMessage", () => {
  it("monta a mensagem completa com linhas em branco separando os blocos", () => {
    expect(buildQuoteMessage(complete)).toBe(
      [
        "Olá! Vim pelo site da PeriniHub e gostaria de um orçamento.",
        "",
        "Nome: Maria Silva",
        "Empresa: Padaria Central",
        "WhatsApp: (11) 98888-7777",
        "Tipo de projeto: Site institucional",
        "",
        "Sobre o projeto: Preciso de um site com cardápio.",
      ].join("\n"),
    );
  });

  it("omite a linha de empresa quando ela está vazia ou só com espaços", () => {
    expect(buildQuoteMessage({ ...complete, company: "  " })).not.toContain("Empresa:");
  });

  it("remove espaços nas pontas dos valores digitados", () => {
    expect(buildQuoteMessage({ ...complete, name: "  Maria Silva  " })).toContain("Nome: Maria Silva\n");
  });

  it("preserva quebras de linha dentro da descrição do projeto", () => {
    const message = buildQuoteMessage({ ...complete, message: "Linha 1\nLinha 2" });
    expect(message.endsWith("Sobre o projeto: Linha 1\nLinha 2")).toBe(true);
  });

  it("limita o tamanho da descrição para não gerar URLs gigantes", () => {
    const message = buildQuoteMessage({ ...complete, message: "a".repeat(MESSAGE_MAX_LENGTH + 500) });
    expect(message.endsWith("a".repeat(MESSAGE_MAX_LENGTH))).toBe(true);
    expect(message).not.toContain("a".repeat(MESSAGE_MAX_LENGTH + 1));
  });
});
