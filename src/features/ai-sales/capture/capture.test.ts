import { describe, expect, it } from "vitest";

import { formatCnpj, isValidCnpj, mapBrasilApiCnpj, normalizeCnpj } from "./cnpj";
import { HONEYPOT_FIELD, isHoneypotFilled, parseSubmission, submissionHash, toRecord } from "./submission";

const ALL = ["phone", "email", "company", "job_title", "message"];

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
    expect(normalizeCnpj(" 11.222.333/0001-81 ")).toBe("11222333000181");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("mapeia só campos da empresa (sem sócios, telefone ou e-mail)", () => {
    const data = mapBrasilApiCnpj({
      razao_social: "PADARIA EXEMPLO LTDA",
      nome_fantasia: "PADARIA EXEMPLO",
      cnae_fiscal: 1091102,
      cnae_fiscal_descricao: "Fabricação de produtos de panificação",
      municipio: "SAO PAULO",
      uf: "sp",
      descricao_situacao_cadastral: "ATIVA",
      porte: "MICRO EMPRESA",
      data_inicio_atividade: "2015-03-02",
      ddd_telefone_1: "11999998888",
      email: "dono@exemplo.com",
      qsa: [{ nome_socio: "FULANO" }],
    });
    expect(data).toEqual({
      name: "PADARIA EXEMPLO LTDA",
      trade_name: "PADARIA EXEMPLO",
      cnae: "1091102",
      cnae_description: "Fabricação de produtos de panificação",
      city: "Sao Paulo",
      state: "SP",
      registration_status: "Ativa",
      size: "MICRO EMPRESA",
      opened_on: "2015-03-02",
    });
    expect(JSON.stringify(data)).not.toMatch(/9999|dono@|FULANO/);
    expect(mapBrasilApiCnpj({ message: "CNPJ não encontrado" })).toBeNull();
    expect(mapBrasilApiCnpj(null)).toBeNull();
  });

  it("CNAE com zero à esquerda", () => {
    expect(mapBrasilApiCnpj({ razao_social: "X", cnae_fiscal: 111301 })?.cnae).toBe("0111301");
  });
});

describe("envio do formulário", () => {
  const base = { full_name: "Maria Souza", consent_version: "2" };

  it("normaliza telefone e e-mail; consentimento só quando marcado", () => {
    const result = parseSubmission({ ...base, phone: "(11) 97541-8690", email: "Maria@Exemplo.com", consent: "on" }, ALL);
    expect(result).toMatchObject({ ok: true, data: { phone: "+5511975418690", email: "maria@exemplo.com", consent: true, consentVersion: 2 } });
    const without = parseSubmission({ ...base, email: "maria@exemplo.com" }, ALL);
    expect(without.ok && without.data.consent).toBe(false);
  });

  it("exige telefone ou e-mail e recusa telefone inválido", () => {
    expect(parseSubmission(base, ALL)).toEqual({ ok: false, error: "Informe telefone ou e-mail." });
    expect(parseSubmission({ ...base, phone: "123" }, ALL)).toMatchObject({ ok: false, error: expect.stringMatching(/Telefone inválido/) });
    expect(parseSubmission({ ...base, email: "não-é-email" }, ALL)).toMatchObject({ ok: false, error: "E-mail inválido." });
    expect(parseSubmission({ full_name: "M", email: "a@b.co", consent_version: "1" }, ALL)).toMatchObject({ ok: false });
    expect(parseSubmission({ full_name: "Maria", email: "a@b.co" }, ALL)).toMatchObject({ ok: false });
  });

  it("ignora campos que o formulário não pede", () => {
    const result = parseSubmission({ ...base, email: "a@b.co", phone: "11975418690", company: "ACME", message: "oi" }, ["email"]);
    expect(result).toMatchObject({ ok: true, data: { phone: null, company: null, message: null, email: "a@b.co" } });
    expect(parseSubmission({ ...base, email: "a@b.co" }, ["phone"])).toEqual({ ok: false, error: "Informe seu telefone." });
  });

  it("honeypot, hash e conversão de FormData", () => {
    expect(isHoneypotFilled({ [HONEYPOT_FIELD]: "http://spam" })).toBe(true);
    expect(isHoneypotFilled({ [HONEYPOT_FIELD]: "  " })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
    const form = new FormData();
    form.append("full_name", "Ana");
    form.append("full_name", "Outro");
    expect(toRecord(form)).toEqual({ full_name: "Ana" });
    expect(toRecord([1, 2])).toEqual({});
    const parsed = parseSubmission({ ...base, email: "a@b.co" }, ALL);
    if (!parsed.ok) throw new Error("esperava ok");
    expect(submissionHash(parsed.data, "k")).toMatch(/^[0-9a-f]{64}$/);
    expect(submissionHash(parsed.data, "k")).not.toBe(submissionHash(parsed.data, "outro"));
  });
});
