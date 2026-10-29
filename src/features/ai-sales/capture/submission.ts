import { createHash } from "node:crypto";

import { z } from "zod";

import { normalizePhone } from "../crm/phone";
import { HONEYPOT_FIELD } from "./constants";

// Envio do formulário público: validação, honeypot e hash da prova. Puro
// (sem banco), para a rota e para os testes.

export const FORM_FIELDS = ["phone", "email", "company", "job_title", "message"] as const;
export type FormField = (typeof FORM_FIELDS)[number];

export { HONEYPOT_FIELD } from "./constants";

export const MAX_SUBMISSION_BYTES = 16_000;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((value) => value || null);

const schema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(160, "Nome muito longo."),
  phone: optional(40),
  email: optional(254).refine((value) => value === null || z.email().safeParse(value).success, "E-mail inválido."),
  company: optional(200),
  job_title: optional(120),
  message: optional(2000),
  consent: z.union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(true)]).optional(),
  consent_version: z.coerce.number().int().min(1).max(100_000),
});

export type ParsedSubmission = {
  fullName: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  message: string | null;
  consent: boolean;
  consentVersion: number;
};

export type SubmissionResult = { ok: true; data: ParsedSubmission } | { ok: false; error: string };

/** Valida o envio contra os campos que o formulário pede (campos não pedidos são ignorados). */
export function parseSubmission(input: Record<string, unknown>, fields: readonly string[]): SubmissionResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;
  const asks = (field: FormField) => fields.includes(field);

  let phone: string | null = null;
  if (asks("phone") && data.phone) {
    phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Telefone inválido. Use DDD + número." };
  }
  const email = asks("email") ? (data.email?.toLowerCase() ?? null) : null;
  if (!phone && !email) {
    return { ok: false, error: asks("phone") && asks("email") ? "Informe telefone ou e-mail." : asks("phone") ? "Informe seu telefone." : "Informe seu e-mail." };
  }
  return {
    ok: true,
    data: {
      fullName: data.full_name,
      phone,
      email,
      company: asks("company") ? data.company : null,
      jobTitle: asks("job_title") ? data.job_title : null,
      message: asks("message") ? data.message : null,
      consent: data.consent !== undefined,
      consentVersion: data.consent_version,
    },
  };
}

export function isHoneypotFilled(input: Record<string, unknown>) {
  const value = input[HONEYPOT_FIELD];
  return typeof value === "string" ? value.trim() !== "" : value != null;
}

/** Hash do conteúdo enviado (prova sem guardar uma segunda cópia dos dados). */
export function submissionHash(data: ParsedSubmission, formKey: string) {
  return createHash("sha256").update(JSON.stringify({ formKey, ...data })).digest("hex");
}

/** Converte FormData ou JSON em objeto simples (primeiro valor de cada campo). */
export function toRecord(source: FormData | unknown): Record<string, unknown> {
  if (source instanceof FormData) {
    const record: Record<string, unknown> = {};
    for (const [key, value] of source.entries()) {
      if (!(key in record) && typeof value === "string") record[key] = value;
    }
    return record;
  }
  return source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>) : {};
}

/** Códigos da função capture_form_submit → mensagem para o titular. */
export const SUBMIT_MESSAGES: Record<string, string> = {
  form_unavailable: "Este formulário não está disponível.",
  consent_version_changed: "O texto de autorização foi atualizado. Recarregue a página e envie de novo.",
  name_required: "Informe seu nome.",
  contact_required: "Informe telefone ou e-mail.",
  rate_limited: "Muitos envios em pouco tempo. Tente de novo em alguns minutos.",
  invalid: "Dados inválidos.",
  error: "Não foi possível enviar agora. Tente novamente.",
};
