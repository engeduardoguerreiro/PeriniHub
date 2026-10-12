import { buildWhatsAppUrl } from "@/lib/site";

export const MESSAGE_MAX_LENGTH = 1500;

export type QuoteField = "name" | "whatsapp" | "projectType" | "message";

export type QuoteInput = {
  name: string;
  company: string;
  whatsapp: string;
  projectType: string;
  message: string;
};

export const fieldErrors: Record<QuoteField, string> = {
  name: "Informe seu nome.",
  whatsapp: "Informe um WhatsApp com DDD.",
  projectType: "Escolha o tipo de projeto.",
  message: "Conte um pouco sobre o que você precisa.",
};

/** Ordem em que os campos aparecem no formulário (usada para focar o primeiro erro). */
export const QUOTE_FIELDS: QuoteField[] = ["name", "whatsapp", "projectType", "message"];

/** Um telefone brasileiro com DDD tem 10 ou 11 dígitos (13 com o 55 na frente). */
function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

export function validateQuote(input: QuoteInput): QuoteField[] {
  const invalid: QuoteField[] = [];
  if (!input.name.trim()) invalid.push("name");
  if (!isValidPhone(input.whatsapp)) invalid.push("whatsapp");
  if (!input.projectType) invalid.push("projectType");
  if (!input.message.trim()) invalid.push("message");
  return invalid;
}

export function buildQuoteMessage(input: QuoteInput) {
  const company = input.company.trim();
  return [
    "Olá! Vim pelo site da PeriniHub e gostaria de um orçamento.",
    "",
    `Nome: ${input.name.trim()}`,
    company ? `Empresa: ${company}` : null,
    `WhatsApp: ${input.whatsapp.trim()}`,
    `Tipo de projeto: ${input.projectType}`,
    "",
    `Sobre o projeto: ${input.message.trim().slice(0, MESSAGE_MAX_LENGTH)}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildQuoteUrl(input: QuoteInput) {
  return buildWhatsAppUrl(buildQuoteMessage(input));
}
