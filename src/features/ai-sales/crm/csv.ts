import { normalizePhone } from "./phone";

// Importação e exportação de CSV, sem dependências. Aceita vírgula ou
// ponto e vírgula (Excel em português), aspas e BOM.

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, "");
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Nomes de coluna aceitos (sem acento, minúsculas) para cada campo. */
const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ["nome", "nome completo", "contato", "name", "full name"],
  phone: ["telefone", "celular", "whatsapp", "fone", "phone", "telefone/whatsapp"],
  email: ["email", "e-mail", "e mail"],
  company_name: ["empresa", "razao social", "company", "nome da empresa"],
  company_document: ["cnpj", "documento"],
  job_title: ["cargo", "funcao", "job title"],
  city: ["cidade", "municipio", "city"],
  state: ["uf", "estado", "state"],
  tags: ["tags", "etiquetas", "segmento"],
  consent_whatsapp: ["consentimento whatsapp", "consentimento", "autorizou whatsapp", "opt-in", "optin"],
};

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export type ImportRow = {
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  company_name: string | null;
  company_document: string | null;
  job_title: string | null;
  city: string | null;
  state: string | null;
  tags: string[];
  consent_whatsapp: boolean;
};

export type RejectedRow = { line: number; reason: string };

const YES = new Set(["sim", "s", "yes", "y", "true", "1", "x"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mapImportRows(table: string[][]): { rows: ImportRow[]; rejected: RejectedRow[]; missingColumns: string[] } {
  const [header = [], ...body] = table;
  const index: Record<string, number> = {};
  header.forEach((name, i) => {
    const normalized = normalizeHeader(name);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (index[field] === undefined && aliases.includes(normalized)) index[field] = i;
    }
  });
  const missingColumns = index.full_name === undefined ? ["nome"] : [];
  if (index.phone === undefined && index.email === undefined) missingColumns.push("telefone ou e-mail");
  if (missingColumns.length) return { rows: [], rejected: [], missingColumns };

  const rows: ImportRow[] = [];
  const rejected: RejectedRow[] = [];
  const cell = (cells: string[], field: string) => (index[field] === undefined ? "" : (cells[index[field]] ?? "").trim());

  body.forEach((cells, i) => {
    const line = i + 2;
    const fullName = cell(cells, "full_name").slice(0, 160);
    const rawPhone = cell(cells, "phone");
    const rawEmail = cell(cells, "email").toLowerCase();
    const phone = normalizePhone(rawPhone);
    const email = EMAIL.test(rawEmail) && rawEmail.length <= 254 ? rawEmail : null;
    if (!fullName) return void rejected.push({ line, reason: "sem nome" });
    if (rawPhone && !phone && !email) return void rejected.push({ line, reason: "telefone inválido" });
    if (!phone && !email) return void rejected.push({ line, reason: "sem telefone nem e-mail válidos" });
    const document = cell(cells, "company_document").replace(/\D/g, "");
    const state = cell(cells, "state").toUpperCase();
    rows.push({
      full_name: fullName,
      phone_e164: phone,
      email,
      company_name: cell(cells, "company_name").slice(0, 200) || null,
      company_document: document.length === 14 ? document : null,
      job_title: cell(cells, "job_title").slice(0, 120) || null,
      city: cell(cells, "city").slice(0, 80) || null,
      state: /^[A-Z]{2}$/.test(state) ? state : null,
      tags: cell(cells, "tags")
        .split(/[|,]/)
        .map((tag) => tag.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 10),
      consent_whatsapp: YES.has(normalizeHeader(cell(cells, "consent_whatsapp"))),
    });
  });
  return { rows, rejected, missingColumns };
}

/**
 * Célula segura para CSV: escapa aspas e neutraliza fórmulas (=, +, -, @,
 * tab, CR) que o Excel executaria ao abrir o arquivo.
 */
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]) {
  // ";" e BOM: abre direto no Excel em português.
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
