import { describe, expect, it } from "vitest";

import { csvCell, mapImportRows, parseCsv, toCsv } from "./csv";
import { formatPhone, maskPhone, normalizePhone } from "./phone";
import { searchTerm } from "./queries";

describe("telefone", () => {
  it("normaliza números brasileiros em vários formatos para E.164", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("+5511987654321");
    expect(normalizePhone("11987654321")).toBe("+5511987654321");
    expect(normalizePhone("+55 21 3333-4444")).toBe("+552133334444");
    expect(normalizePhone("+1 650 253 0000")).toBe("+16502530000");
  });

  it("recusa lixo e números inválidos", () => {
    for (const value of ["", "abc", "123", "(00) 0000-0000", null, undefined]) expect(normalizePhone(value)).toBeNull();
  });

  it("formata para exibição e mascara para logs", () => {
    expect(formatPhone("+5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhone(null)).toBe("—");
    expect(maskPhone("+5511987654321")).toBe("+5511****4321");
  });
});

describe("CSV", () => {
  it("lê ponto e vírgula do Excel, aspas, quebras de linha em campo e BOM", () => {
    const text = '\uFEFFNome;Telefone;Empresa\r\n"Silva; João";(11) 98765-4321;"Acme ""Ltda"""\r\nMaria;;"Linha\nquebrada"\r\n';
    expect(parseCsv(text)).toEqual([
      ["Nome", "Telefone", "Empresa"],
      ["Silva; João", "(11) 98765-4321", 'Acme "Ltda"'],
      ["Maria", "", "Linha\nquebrada"],
    ]);
  });

  it("mapeia colunas em português, normaliza e rejeita linhas inválidas com o motivo", () => {
    const table = parseCsv(
      [
        "Nome Completo,Celular,E-mail,Razão Social,CNPJ,UF,Tags,Consentimento WhatsApp",
        "Ana,(11) 98765-4321,ANA@X.COM,Acme,12.345.678/0001-90,sp,cliente|feira,sim",
        ",11987654320,b@x.com,,,,,",
        "Sem Contato,,,,,,,",
        "Fone ruim,123,,,,,,",
        "Só email,,c@x.com,,,,,não",
      ].join("\n"),
    );
    const { rows, rejected, missingColumns } = mapImportRows(table);
    expect(missingColumns).toEqual([]);
    expect(rows).toEqual([
      expect.objectContaining({ full_name: "Ana", phone_e164: "+5511987654321", email: "ana@x.com", company_name: "Acme", company_document: "12345678000190", state: "SP", tags: ["cliente", "feira"], consent_whatsapp: true }),
      expect.objectContaining({ full_name: "Só email", phone_e164: null, email: "c@x.com", consent_whatsapp: false }),
    ]);
    expect(rejected).toEqual([
      { line: 3, reason: "sem nome" },
      { line: 4, reason: "sem telefone nem e-mail válidos" },
      { line: 5, reason: "telefone inválido" },
    ]);
  });

  it("aponta colunas obrigatórias ausentes", () => {
    expect(mapImportRows(parseCsv("Empresa,Cidade\nAcme,SP")).missingColumns).toEqual(["nome", "telefone ou e-mail"]);
  });

  it("neutraliza fórmulas na exportação (injeção de CSV) e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+5511987654321")).toBe("'+5511987654321");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("normal")).toBe("normal");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [["1", "x;y"]])).toBe('\uFEFFa;b\r\n1;"x;y"\r\n');
  });
});

describe("busca", () => {
  it("remove caracteres que alterariam o filtro do PostgREST", () => {
    expect(searchTerm("joão, (or) id.eq.1*%")).toBe("joão or id.eq.1");
    expect(searchTerm(42)).toBe("");
    expect(searchTerm("a".repeat(200))).toHaveLength(80);
  });
});
