import "server-only";

import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Consultas da captação com a sessão do usuário (RLS) e tenant_id explícito.

export async function listCaptureForms(tenantId: string) {
  const db = await createSalesSessionClient();
  const { data } = await db
    .from("capture_forms")
    .select("id, name, headline, status, public_key, submissions_count, consent_version, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCaptureForm(tenantId: string, formId: string) {
  const db = await createSalesSessionClient();
  const { data: form } = await db.from("capture_forms").select("*").eq("tenant_id", tenantId).eq("id", formId).maybeSingle();
  if (!form) return null;
  const [versions, submissions, consented] = await Promise.all([
    db.from("capture_form_consent_versions").select("version, consent_text, consent_channels, consent_purposes, text_hash, created_at").eq("tenant_id", tenantId).eq("form_id", formId).order("version", { ascending: false }),
    db
      .from("form_submissions")
      .select("id, consent_given, consent_version, fields_received, created_at, contact:contacts(id, full_name), lead_id")
      .eq("tenant_id", tenantId)
      .eq("form_id", formId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("form_submissions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("form_id", formId).eq("consent_given", true),
  ]);
  return { form, versions: versions.data ?? [], submissions: submissions.data ?? [], consentedCount: consented.count ?? 0 };
}

export async function listCompanyEnrichments(tenantId: string, companyId: string) {
  const db = await createSalesSessionClient();
  const { data } = await db
    .from("company_enrichments")
    .select("id, source, status, data, applied_fields, fetched_at")
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .order("fetched_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
