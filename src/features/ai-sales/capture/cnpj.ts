// CNPJ: normalização, dígitos verificadores e mapeamento da consulta pública
// (BrasilAPI, dados abertos da Receita Federal). Só campos da empresa entram
// no CRM: sócios, telefone e e-mail cadastrais ficam de fora — podem ser de
// pessoa física (MEI) e nunca valem como autorização de contato.

export function normalizeCnpj(input: unknown) {
  return typeof input === "string" ? input.replace(/\D/g, "") : "";
}

export function isValidCnpj(input: unknown) {
  const digits = normalizeCnpj(input);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

export function formatCnpj(digits: string | null | undefined) {
  if (!digits || !/^\d{14}$/.test(digits)) return digits ?? "—";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export type CnpjData = {
  name: string;
  trade_name: string | null;
  cnae: string | null;
  cnae_description: string | null;
  city: string | null;
  state: string | null;
  registration_status: string | null;
  size: string | null;
  opened_on: string | null;
};

const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

/** Título em caixa mista para nomes que a Receita publica em maiúsculas. */
function titleCase(value: string | null) {
  if (!value) return null;
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s/-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("pt-BR"))
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (word) => word.toLowerCase());
}

/** Mapeia a resposta de /api/cnpj/v1/{cnpj} da BrasilAPI; null se não parecer uma resposta válida. */
export function mapBrasilApiCnpj(raw: unknown): CnpjData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const name = text(data.razao_social, 200);
  if (!name) return null;
  const cnae = data.cnae_fiscal == null ? null : String(data.cnae_fiscal).replace(/\D/g, "").padStart(7, "0");
  const state = text(data.uf, 2)?.toUpperCase() ?? null;
  const opened = text(data.data_inicio_atividade, 10);
  return {
    name,
    trade_name: text(data.nome_fantasia, 200),
    cnae: cnae && /^\d{7}$/.test(cnae) ? cnae : null,
    cnae_description: text(data.cnae_fiscal_descricao, 200),
    city: titleCase(text(data.municipio, 80)),
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    registration_status: titleCase(text(data.descricao_situacao_cadastral, 40)),
    size: text(data.porte, 60) ?? text(data.descricao_porte, 60),
    opened_on: opened && /^\d{4}-\d{2}-\d{2}$/.test(opened) ? opened : null,
  };
}
