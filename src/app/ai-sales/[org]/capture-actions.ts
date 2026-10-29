"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { consumeRateLimit } from "@/features/ai-sales/auth/rate-limit";
import type { OrgRole } from "@/features/ai-sales/auth/roles";
import { lookupCnpj } from "@/features/ai-sales/capture/brasilapi";
import { isValidCnpj, normalizeCnpj } from "@/features/ai-sales/capture/cnpj";
import { FORM_FIELDS } from "@/features/ai-sales/capture/submission";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Captação (formulários) e enriquecimento de empresas. Mesmo padrão das
// demais actions: papel pela empresa do slug, Zod e gravação com a sessão
// do usuário (RLS e triggers conferem de novo).

const uuid = z.uuid();
const NO_PERMISSION = "Sem permissão para esta ação.";
// Consulta de CNPJ: por empresa, para respeitar a BrasilAPI (uso gratuito).
const CNPJ_WINDOW = 3600;
const CNPJ_MAX = 60;

const CAPTURE_MESSAGES: Record<string, string> = {
  capture_forms_fields_check: "Peça ao menos telefone ou e-mail.",
  capture_forms_consent_text_check: "O texto de autorização precisa ter entre 20 e 2000 caracteres.",
  company_not_found: "Empresa não encontrada.",
  document_mismatch: "O CNPJ consultado é diferente do CNPJ da empresa.",
  companies_document_key: "Já existe uma empresa com esse CNPJ.",
};

function captureMessage(message: string | undefined) {
  const code = Object.keys(CAPTURE_MESSAGES).find((key) => message?.includes(key));
  return code ? CAPTURE_MESSAGES[code] : dbMessage(message);
}

async function member(slug: string, minRole: OrgRole) {
  const membership = await findMembership(slug, minRole);
  if (!membership) return null;
  return { ...membership, db: await createSalesSessionClient() };
}

// --- Formulários -----------------------------------------------------------------

const formSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome interno.").max(80),
  headline: z.string().trim().min(2, "Informe o título da página.").max(120),
  description: z.string().trim().max(1000).transform((value) => value || null),
  fields: z.array(z.enum(FORM_FIELDS)).refine((list) => list.includes("phone") || list.includes("email"), "Peça ao menos telefone ou e-mail."),
  consentText: z.string().trim().min(20, "O texto de autorização precisa ter ao menos 20 caracteres.").max(2000),
  channels: z.array(z.enum(["whatsapp", "email", "phone"])).min(1, "Escolha ao menos um canal autorizado."),
  purposes: z.array(z.enum(["marketing", "sales_followup", "service", "transactional"])).min(1, "Escolha ao menos uma finalidade."),
  successMessage: z.string().trim().min(2).max(300),
  sourceId: z.union([uuid, z.literal("")]).transform((value) => value || null),
});

function formValues(formData: FormData) {
  return formSchema.safeParse({
    name: formData.get("name"),
    headline: formData.get("headline"),
    description: formData.get("description") ?? "",
    fields: [...new Set(formData.getAll("fields"))],
    consentText: formData.get("consentText"),
    channels: [...new Set(formData.getAll("channels"))],
    purposes: [...new Set(formData.getAll("purposes"))],
    successMessage: formData.get("successMessage"),
    sourceId: formData.get("sourceId") ?? "",
  });
}

function formRow(data: z.infer<typeof formSchema>) {
  return {
    name: data.name,
    headline: data.headline,
    description: data.description,
    fields: data.fields,
    consent_text: data.consentText,
    consent_channels: data.channels,
    consent_purposes: data.purposes,
    success_message: data.successMessage,
    lead_source_id: data.sourceId,
  };
}

export async function createCaptureForm(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const parsed = formValues(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await m.db.from("capture_forms").insert({ tenant_id: m.tenantId, ...formRow(parsed.data) }).select("id").single();
  if (error) return fail(captureMessage(error.message));
  redirect(orgPath(slug, `capture/${data.id}`));
}

export async function updateCaptureForm(slug: string, formId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(formId).success) return fail("Formulário inválido.");
  const parsed = formValues(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await m.db
    .from("capture_forms")
    .update(formRow(parsed.data))
    .eq("tenant_id", m.tenantId)
    .eq("id", formId)
    .select("consent_version");
  if (error) return fail(captureMessage(error.message));
  if (!data?.length) return fail("Formulário não encontrado.");
  refresh();
  return { ok: true, message: `Formulário salvo (autorização: versão ${data[0].consent_version}).` };
}

export async function setCaptureFormStatus(slug: string, formId: string, status: "active" | "paused"): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(formId).success || !["active", "paused"].includes(status)) return fail("Dados inválidos.");
  const { data, error } = await m.db.from("capture_forms").update({ status }).eq("tenant_id", m.tenantId).eq("id", formId).select("id");
  if (error) return fail(captureMessage(error.message));
  if (!data?.length) return fail("Formulário não encontrado.");
  refresh();
  return { ok: true, message: status === "active" ? "Formulário publicado." : "Formulário pausado." };
}

// --- Enriquecimento pelo CNPJ -------------------------------------------------------

async function cnpjAllowed(tenantId: string) {
  return consumeRateLimit(`cnpj:${tenantId}`, CNPJ_WINDOW, CNPJ_MAX);
}

export async function enrichCompany(slug: string, companyId: string): Promise<ActionResult> {
  const m = await member(slug, "sales");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(companyId).success) return fail("Empresa inválida.");
  const { data: company } = await m.db.from("companies").select("document").eq("tenant_id", m.tenantId).eq("id", companyId).is("deleted_at", null).maybeSingle();
  if (!company) return fail("Empresa não encontrada.");
  if (!company.document || !isValidCnpj(company.document)) return fail("Cadastre um CNPJ válido na empresa antes de consultar.");
  if (!(await cnpjAllowed(m.tenantId))) return fail("Limite de consultas de CNPJ atingido. Tente de novo em uma hora.");

  const lookup = await lookupCnpj(company.document);
  const { data, error } = await m.db.rpc("company_apply_enrichment", {
    p_tenant: m.tenantId,
    p_company: companyId,
    p_document: company.document,
    p_status: lookup.status,
    p_data: lookup.status === "success" ? lookup.data : lookup.status === "error" ? { error: lookup.message } : {},
  });
  if (error) return fail(captureMessage(error.message));
  refresh();
  if (lookup.status === "not_found") return fail("CNPJ não encontrado na base pública.");
  if (lookup.status === "error") return fail(`${lookup.message}. Tente de novo mais tarde.`);
  const applied = data?.applied_fields.length ?? 0;
  return { ok: true, message: applied ? `Dados públicos aplicados em ${applied} campo(s) vazio(s).` : "Consulta registrada; nenhum campo vazio para preencher." };
}

const prospectSchema = z.object({
  document: z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido."),
  createLead: z.boolean(),
});

/** Prospecção: cria a empresa a partir do CNPJ (dados públicos) e, se pedido, um lead "empresa identificada". */
export async function createCompanyFromCnpj(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "sales");
  if (!m) return fail(NO_PERMISSION);
  const parsed = prospectSchema.safeParse({ document: formData.get("document") ?? "", createLead: formData.get("createLead") === "on" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { document, createLead } = parsed.data;

  const { data: existing } = await m.db.from("companies").select("id").eq("tenant_id", m.tenantId).eq("document", document).is("deleted_at", null).maybeSingle();
  if (existing) return fail("Já existe uma empresa com esse CNPJ.");
  if (!(await cnpjAllowed(m.tenantId))) return fail("Limite de consultas de CNPJ atingido. Tente de novo em uma hora.");

  const lookup = await lookupCnpj(document);
  if (lookup.status === "not_found") return fail("CNPJ não encontrado na base pública.");
  if (lookup.status === "error") return fail(`${lookup.message}. Tente de novo mais tarde.`);

  const at = new Date().toISOString();
  const { data: company, error } = await m.db
    .from("companies")
    .insert({ tenant_id: m.tenantId, name: lookup.data.trade_name ?? lookup.data.name, document, provenance: { name: { source: "brasilapi_cnpj", at } } })
    .select("id")
    .single();
  if (error) return fail(captureMessage(error.message));
  const applied = await m.db.rpc("company_apply_enrichment", { p_tenant: m.tenantId, p_company: company.id, p_document: document, p_status: "success", p_data: lookup.data });
  if (applied.error) return fail(captureMessage(applied.error.message));

  if (createLead) {
    const { data: stage } = await m.db
      .from("pipeline_stages")
      .select("id, pipeline_id, pipelines!inner(is_default)")
      .eq("tenant_id", m.tenantId)
      .eq("pipelines.is_default", true)
      .order("position")
      .limit(1)
      .maybeSingle();
    const { data: source } = await m.db.from("lead_sources").select("id").eq("tenant_id", m.tenantId).eq("kind", "research").eq("active", true).limit(1).maybeSingle();
    if (stage) {
      const lead = await m.db.from("leads").insert({
        tenant_id: m.tenantId,
        company_id: company.id,
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        lead_source_id: source?.id ?? null,
        owner_user_id: m.user.id,
        title: "Prospecção por CNPJ",
      });
      if (lead.error) return fail(captureMessage(lead.error.message));
    }
  }
  redirect(orgPath(slug, `companies/${company.id}`));
}
