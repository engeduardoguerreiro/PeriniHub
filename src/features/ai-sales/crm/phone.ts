import { parsePhoneNumberFromString } from "libphonenumber-js/min";

// Telefones sempre em E.164 no banco (+5511999998888). Sem DDI, assume Brasil.

export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "BR");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "—";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "BR" ? parsed.formatNational() : parsed.formatInternational();
}

/** Telefone mascarado para logs e telas de baixa permissão: +55 11 9****-8888. */
export function maskPhone(e164: string) {
  return e164.length > 8 ? `${e164.slice(0, 5)}****${e164.slice(-4)}` : "****";
}
