import "server-only";

import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { type ParsedSubmission, SUBMIT_MESSAGES } from "./submission";

// Leitura e envio dos formulários públicos. Não há sessão: usa a secret key,
// sempre pelo public_key do link, e só expõe o necessário para o titular.

export const PUBLIC_KEY_PATTERN = /^[a-z0-9]{32}$/;

export type PublicForm = {
  key: string;
  organization: string;
  headline: string;
  description: string | null;
  fields: string[];
  consentText: string;
  consentVersion: number;
  successMessage: string;
};

export async function loadPublicForm(key: string): Promise<PublicForm | null> {
  if (!PUBLIC_KEY_PATTERN.test(key)) return null;
  const { data } = await createSalesServiceClient()
    .from("capture_forms")
    .select("public_key, headline, description, fields, consent_text, consent_version, success_message, status, organization:organizations(name, status)")
    .eq("public_key", key)
    .maybeSingle();
  if (!data || data.status !== "active" || data.organization?.status !== "active") return null;
  return {
    key: data.public_key,
    organization: data.organization.name,
    headline: data.headline,
    description: data.description,
    fields: data.fields,
    consentText: data.consent_text,
    consentVersion: data.consent_version,
    successMessage: data.success_message,
  };
}

export type SubmitOutcome = { ok: true; message: string } | { ok: false; code: keyof typeof SUBMIT_MESSAGES; message: string };

export async function submitPublicForm(
  form: PublicForm,
  data: ParsedSubmission,
  meta: { payloadHash: string; ipHash: string; userAgent: string | null },
): Promise<SubmitOutcome> {
  const { error } = await createSalesServiceClient().rpc("capture_form_submit", {
    p_public_key: form.key,
    p_full_name: data.fullName,
    p_phone_e164: data.phone,
    p_email: data.email,
    p_company: data.company,
    p_job_title: data.jobTitle,
    p_message: data.message,
    p_consent: data.consent,
    p_consent_version: data.consentVersion,
    p_payload_hash: meta.payloadHash,
    p_ip_hash: meta.ipHash,
    p_user_agent: meta.userAgent,
    // O gerador de tipos não marca argumentos de função como anuláveis; a função aceita null.
  } as never);
  if (!error) return { ok: true, message: form.successMessage };
  const code = (Object.keys(SUBMIT_MESSAGES).find((key) => error.message.includes(key)) ?? "error") as keyof typeof SUBMIT_MESSAGES;
  if (code === "error") console.error("[ai-sales] envio de formulário falhou:", error.message.slice(0, 200));
  return { ok: false, code, message: SUBMIT_MESSAGES[code] };
}
