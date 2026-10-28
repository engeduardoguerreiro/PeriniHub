"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dbMessage, fail, type ActionResult } from "@/features/ai-sales/action-result";
import { findMembership } from "@/features/ai-sales/auth/dal";
import { clientIpHash, consumeRateLimit } from "@/features/ai-sales/auth/rate-limit";
import type { OrgRole } from "@/features/ai-sales/auth/roles";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, mapImportRows, parseCsv } from "@/features/ai-sales/crm/csv";
import { normalizePhone } from "@/features/ai-sales/crm/phone";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Ações do CRM. Padrão de todas: (1) resolve a empresa pelo slug e confere o
// papel (findMembership); (2) valida a entrada com Zod; (3) grava com a sessão
// do usuário, sempre com tenant_id da empresa resolvida — o RLS, as FKs
// compostas e os triggers do banco conferem tudo de novo.

const uuid = z.uuid();
const NO_PERMISSION = "Sem permissão para esta ação.";

const CRM_MESSAGES: Record<string, string> = {
  contacts_phone_key: "Já existe um contato com esse telefone.",
  contacts_email_key: "Já existe um contato com esse e-mail.",
  companies_document_key: "Já existe uma empresa com esse CNPJ.",
  delete_requires_manager: "Só gestores podem excluir.",
  suppression_list_tenant_id_channel_identifier_key: "Esse contato já está na lista de supressão.",
  tags_name_key: "Já existe uma tag com esse nome.",
  lead_sources_name_key: "Já existe uma origem com esse nome.",
  leads_tenant_id_pipeline_id_stage_id_fkey: "Há leads nessa etapa. Mova-os antes de excluir.",
  too_many_rows: `O arquivo passa de ${MAX_IMPORT_ROWS} linhas.`,
};

function crmMessage(message: string | undefined) {
  const code = Object.keys(CRM_MESSAGES).find((key) => message?.includes(key));
  return code ? CRM_MESSAGES[code] : dbMessage(message);
}

async function member(slug: string, minRole: OrgRole = "sales") {
  const membership = await findMembership(slug, minRole);
  if (!membership) return null;
  return { ...membership, db: await createSalesSessionClient() };
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const optionalUuid = z.union([uuid, z.literal("")]).transform((value) => value || null);

// --- Leads ----------------------------------------------------------------------

const newLeadSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome do contato.").max(160),
  phone: z.string().trim().max(40),
  email: z.union([z.email("E-mail inválido.").max(254), z.literal("")]),
  companyName: optionalText(200),
  title: optionalText(160),
  sourceId: optionalUuid,
  ownerId: optionalUuid,
  stageId: uuid,
  consent: z.boolean(),
  consentSource: optionalText(200),
});

export async function createLead(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = newLeadSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    companyName: formData.get("companyName") ?? "",
    title: formData.get("title") ?? "",
    sourceId: formData.get("sourceId") ?? "",
    ownerId: formData.get("ownerId") ?? "",
    stageId: formData.get("stageId"),
    consent: formData.get("consent") === "on",
    consentSource: formData.get("consentSource") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (data.phone && !phone) return fail("Telefone inválido. Use DDD e número, ex.: (11) 99999-8888.");
  if (!phone && !data.email) return fail("Informe telefone ou e-mail.");
  if (data.consent && !phone) return fail("Consentimento de WhatsApp exige telefone.");
  if (data.consent && !data.consentSource) return fail("Diga como o consentimento foi obtido.");

  const { db, tenantId } = m;
  const { data: stage } = await db.from("pipeline_stages").select("id, pipeline_id").eq("tenant_id", tenantId).eq("id", data.stageId).maybeSingle();
  if (!stage) return fail("Etapa inválida.");

  let companyId: string | null = null;
  if (data.companyName) {
    const { data: existing } = await db.from("companies").select("id").eq("tenant_id", tenantId).ilike("name", data.companyName).is("deleted_at", null).limit(1).maybeSingle();
    companyId = existing?.id ?? null;
    if (!companyId) {
      const created = await db.from("companies").insert({ tenant_id: tenantId, name: data.companyName, provenance: { manual: { at: new Date().toISOString() } } }).select("id").single();
      if (created.error) return fail(crmMessage(created.error.message));
      companyId = created.data.id;
    }
  }

  // Deduplicação: telefone ou e-mail já cadastrado reaproveita o contato.
  const filters = [phone && `phone_e164.eq.${phone}`, data.email && `email_normalized.eq.${data.email}`].filter(Boolean).join(",");
  const { data: existingContact } = await db.from("contacts").select("id").eq("tenant_id", tenantId).is("deleted_at", null).or(filters).limit(1).maybeSingle();
  let contactId = existingContact?.id ?? null;
  if (!contactId) {
    const created = await db
      .from("contacts")
      .insert({ tenant_id: tenantId, full_name: data.fullName, phone_e164: phone, email: data.email || null, company_id: companyId, provenance: { manual: { at: new Date().toISOString() } } })
      .select("id")
      .single();
    if (created.error) return fail(crmMessage(created.error.message));
    contactId = created.data.id;
  }

  const lead = await db
    .from("leads")
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      company_id: companyId,
      lead_source_id: data.sourceId,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      owner_user_id: data.ownerId,
      title: data.title,
    })
    .select("id")
    .single();
  if (lead.error) return fail(crmMessage(lead.error.message));

  if (data.consent && data.consentSource) {
    const consent = await db.from("consent_records").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: "whatsapp",
      purpose: "marketing",
      legal_basis: "consent",
      status: "granted",
      source: data.consentSource,
      evidence: { kind: "manual_record", note: "Registrado no cadastro do lead" },
    });
    if (consent.error) return fail(`Lead criado, mas o consentimento não foi salvo: ${crmMessage(consent.error.message)}`);
  }
  redirect(orgPath(slug, `leads/${lead.data.id}`));
}

const leadUpdateSchema = z.object({
  stageId: uuid.optional(),
  ownerId: optionalUuid.optional(),
  qualification: z.enum(["unknown", "cold", "warm", "hot"]).optional(),
  score: z.union([z.coerce.number().int().min(0).max(100), z.literal("")]).transform((value) => (value === "" ? null : value)).optional(),
  title: optionalText(160).optional(),
  discoveryStage: z.enum(["company_identified", "contact_found", "contact_authorized", "qualified_opportunity"]).optional(),
});

export async function updateLead(slug: string, leadId: string, input: Record<string, unknown>): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(leadId).success) return fail("Lead inválido.");
  const parsed = leadUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { stageId, ownerId, qualification, score, title, discoveryStage } = parsed.data;
  const values = {
    ...(stageId !== undefined && { stage_id: stageId }),
    ...(ownerId !== undefined && { owner_user_id: ownerId }),
    ...(qualification !== undefined && { qualification }),
    ...(score !== undefined && { score }),
    ...(title !== undefined && { title }),
    ...(discoveryStage !== undefined && { discovery_stage: discoveryStage }),
  };
  if (!Object.keys(values).length) return fail("Nada para alterar.");
  const { data, error } = await m.db.from("leads").update(values).eq("tenant_id", m.tenantId).eq("id", leadId).select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Lead não encontrado.");
  refresh();
  return { ok: true, message: "Salvo." };
}

export async function deleteLead(slug: string, leadId: string): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(leadId).success) return fail("Lead inválido.");
  const { error } = await m.db.from("leads").update({ deleted_at: new Date().toISOString() }).eq("tenant_id", m.tenantId).eq("id", leadId);
  if (error) return fail(crmMessage(error.message));
  redirect(orgPath(slug, "leads"));
}

// --- Atividades e tarefas ----------------------------------------------------

const noteSchema = z.object({
  leadId: optionalUuid,
  contactId: optionalUuid,
  kind: z.enum(["note", "call", "email", "meeting"]),
  body: z.string().trim().min(1, "Escreva a anotação.").max(4000),
});

export async function addActivity(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = noteSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    contactId: formData.get("contactId") ?? "",
    kind: formData.get("kind"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!parsed.data.leadId && !parsed.data.contactId) return fail("Registro sem lead ou contato.");
  const { error } = await m.db.from("activities").insert({
    tenant_id: m.tenantId,
    lead_id: parsed.data.leadId,
    contact_id: parsed.data.contactId,
    kind: parsed.data.kind,
    body: parsed.data.body,
  });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Registrado." };
}

const taskSchema = z.object({
  leadId: optionalUuid,
  contactId: optionalUuid,
  title: z.string().trim().min(2, "Descreva a tarefa.").max(200),
  // datetime-local do navegador, no fuso da empresa (Brasil, UTC-3).
  dueAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal("")]),
  assigneeId: optionalUuid,
});

export async function createTask(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = taskSchema.safeParse({
    leadId: formData.get("leadId") ?? "",
    contactId: formData.get("contactId") ?? "",
    title: formData.get("title"),
    dueAt: formData.get("dueAt") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await m.db.from("tasks").insert({
    tenant_id: m.tenantId,
    lead_id: parsed.data.leadId,
    contact_id: parsed.data.contactId,
    title: parsed.data.title,
    due_at: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}:00-03:00`).toISOString() : null,
    assignee_user_id: parsed.data.assigneeId ?? m.user.id,
  });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Tarefa criada." };
}

export async function setTaskStatus(slug: string, taskId: string, status: "open" | "done" | "canceled"): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(taskId).success || !["open", "done", "canceled"].includes(status)) return fail("Dados inválidos.");
  const { data, error } = await m.db.from("tasks").update({ status }).eq("tenant_id", m.tenantId).eq("id", taskId).select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Tarefa não encontrada.");
  refresh();
  return { ok: true, message: status === "done" ? "Concluída." : "Atualizada." };
}

// --- Oportunidades -----------------------------------------------------------

const opportunitySchema = z.object({
  leadId: uuid,
  title: z.string().trim().min(2, "Dê um nome à oportunidade.").max(160),
  // Valor em reais, aceita "1.234,56" ou "1234.56".
  amount: z.string().trim().max(20),
  expectedClose: z.union([z.iso.date(), z.literal("")]),
});

function parseBrl(value: string) {
  if (!value) return null;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number < 1e12 ? Math.round(number * 100) : NaN;
}

export async function createOpportunity(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = opportunitySchema.safeParse({
    leadId: formData.get("leadId"),
    title: formData.get("title"),
    amount: formData.get("amount") ?? "",
    expectedClose: formData.get("expectedClose") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const cents = parseBrl(parsed.data.amount);
  if (Number.isNaN(cents)) return fail("Valor inválido.");
  const { error } = await m.db.from("opportunities").insert({
    tenant_id: m.tenantId,
    lead_id: parsed.data.leadId,
    title: parsed.data.title,
    amount_cents: cents,
    expected_close_date: parsed.data.expectedClose || null,
    owner_user_id: m.user.id,
  });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Oportunidade criada." };
}

export async function setOpportunityStatus(slug: string, opportunityId: string, status: "open" | "won" | "lost", reason?: string): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(opportunityId).success || !["open", "won", "lost"].includes(status)) return fail("Dados inválidos.");
  if (status === "lost" && (!reason || reason.trim().length < 3)) return fail("Informe o motivo da perda.");
  const { data, error } = await m.db
    .from("opportunities")
    .update({ status, lost_reason: status === "lost" ? reason!.trim().slice(0, 500) : null })
    .eq("tenant_id", m.tenantId)
    .eq("id", opportunityId)
    .select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Oportunidade não encontrada.");
  refresh();
  return { ok: true, message: "Atualizada." };
}

// --- Contatos e empresas -----------------------------------------------------

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome.").max(160),
  phone: z.string().trim().max(40),
  email: z.union([z.email("E-mail inválido.").max(254), z.literal("")]),
  jobTitle: optionalText(120),
  city: optionalText(80),
  state: z.union([z.string().regex(/^[A-Za-z]{2}$/), z.literal("")]).transform((value) => value.toUpperCase() || null),
  notes: optionalText(4000),
});

export async function updateContact(slug: string, contactId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(contactId).success) return fail("Contato inválido.");
  const parsed = contactSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    jobTitle: formData.get("jobTitle") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const phone = normalizePhone(parsed.data.phone);
  if (parsed.data.phone && !phone) return fail("Telefone inválido.");
  const { data, error } = await m.db
    .from("contacts")
    .update({
      full_name: parsed.data.fullName,
      phone_e164: phone,
      email: parsed.data.email || null,
      job_title: parsed.data.jobTitle,
      city: parsed.data.city,
      state: parsed.data.state,
      notes: parsed.data.notes,
    })
    .eq("tenant_id", m.tenantId)
    .eq("id", contactId)
    .select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Contato não encontrado.");
  refresh();
  return { ok: true, message: "Contato salvo." };
}

export async function deleteContact(slug: string, contactId: string): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(contactId).success) return fail("Contato inválido.");
  const { error } = await m.db.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("tenant_id", m.tenantId).eq("id", contactId);
  if (error) return fail(crmMessage(error.message));
  redirect(orgPath(slug, "contacts"));
}

export async function setContactTags(slug: string, contactId: string, names: string[]): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(contactId).success) return fail("Contato inválido.");
  const clean = [...new Set(names.map((name) => name.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  const { data: existing } = await m.db.from("tags").select("id, name").eq("tenant_id", m.tenantId);
  const ids: string[] = [];
  for (const name of clean) {
    const found = existing?.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (found) {
      ids.push(found.id);
      continue;
    }
    const created = await m.db.from("tags").insert({ tenant_id: m.tenantId, name }).select("id").single();
    if (created.error) return fail(crmMessage(created.error.message));
    ids.push(created.data.id);
  }
  const removed = await m.db.from("contact_tags").delete().eq("tenant_id", m.tenantId).eq("contact_id", contactId);
  if (removed.error) return fail(crmMessage(removed.error.message));
  if (ids.length) {
    const inserted = await m.db.from("contact_tags").insert(ids.map((tagId) => ({ tenant_id: m.tenantId, contact_id: contactId, tag_id: tagId })));
    if (inserted.error) return fail(crmMessage(inserted.error.message));
  }
  refresh();
  return { ok: true, message: "Tags salvas." };
}

const companySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(200),
  document: z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value === "" || value.length === 14, "CNPJ precisa ter 14 dígitos."),
  city: optionalText(80),
  state: z.union([z.string().regex(/^[A-Za-z]{2}$/), z.literal("")]).transform((value) => value.toUpperCase() || null),
  website: z.union([z.url({ protocol: /^https?$/ }).max(300), z.literal("")]),
  notes: optionalText(4000),
});

function companyValues(formData: FormData) {
  return companySchema.safeParse({
    name: formData.get("name"),
    document: formData.get("document") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    website: formData.get("website") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createCompany(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = companyValues(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await m.db
    .from("companies")
    .insert({ tenant_id: m.tenantId, ...parsed.data, document: parsed.data.document || null, website: parsed.data.website || null, provenance: { manual: { at: new Date().toISOString() } } })
    .select("id")
    .single();
  if (error) return fail(crmMessage(error.message));
  redirect(orgPath(slug, `companies/${data.id}`));
}

export async function updateCompany(slug: string, companyId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(companyId).success) return fail("Empresa inválida.");
  const parsed = companyValues(formData);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await m.db
    .from("companies")
    .update({ ...parsed.data, document: parsed.data.document || null, website: parsed.data.website || null })
    .eq("tenant_id", m.tenantId)
    .eq("id", companyId)
    .select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Empresa não encontrada.");
  refresh();
  return { ok: true, message: "Empresa salva." };
}

// --- Consentimento e supressão -----------------------------------------------

const consentSchema = z.object({
  contactId: uuid,
  channel: z.enum(["whatsapp", "email", "phone"]),
  purpose: z.enum(["marketing", "sales_followup", "service", "transactional"]),
  legalBasis: z.enum(["consent", "legitimate_interest", "contract", "legal_obligation"]),
  status: z.enum(["granted", "revoked"]),
  source: z.string().trim().min(3, "Descreva a origem (ex.: formulário do site, pedido por WhatsApp).").max(200),
  evidence: optionalText(1000),
});

export async function recordConsent(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = consentSchema.safeParse({
    contactId: formData.get("contactId"),
    channel: formData.get("channel"),
    purpose: formData.get("purpose"),
    legalBasis: formData.get("legalBasis"),
    status: formData.get("status"),
    source: formData.get("source"),
    evidence: formData.get("evidence") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await m.db.from("consent_records").insert({
    tenant_id: m.tenantId,
    contact_id: parsed.data.contactId,
    channel: parsed.data.channel,
    purpose: parsed.data.purpose,
    legal_basis: parsed.data.legalBasis,
    status: parsed.data.status,
    source: parsed.data.source,
    evidence: { kind: "manual_record", note: parsed.data.evidence },
  });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: parsed.data.status === "granted" ? "Consentimento registrado." : "Revogação registrada." };
}

const suppressionSchema = z.object({
  contactId: uuid,
  channel: z.enum(["whatsapp", "email", "phone"]),
  reason: z.enum(["opt_out", "complaint", "blocked", "invalid", "legal_request"]),
});

/** Descadastro: entra na supressão e revoga o consentimento do canal, de uma vez. */
export async function suppressContact(slug: string, input: { contactId: string; channel: string; reason: string }): Promise<ActionResult> {
  const m = await member(slug);
  if (!m) return fail(NO_PERMISSION);
  const parsed = suppressionSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { data: contact } = await m.db.from("contacts").select("id, phone_e164, email_normalized").eq("tenant_id", m.tenantId).eq("id", parsed.data.contactId).maybeSingle();
  if (!contact) return fail("Contato não encontrado.");
  const identifier = parsed.data.channel === "email" ? contact.email_normalized : contact.phone_e164;
  if (!identifier) return fail(parsed.data.channel === "email" ? "Contato sem e-mail." : "Contato sem telefone.");

  const inserted = await m.db.from("suppression_list").insert({
    tenant_id: m.tenantId,
    channel: parsed.data.channel,
    identifier,
    reason: parsed.data.reason,
    source: "Registro manual no CRM",
  });
  if (inserted.error && inserted.error.code !== "23505") return fail(crmMessage(inserted.error.message));
  const purposes = ["marketing", "sales_followup", "service", "transactional"] as const;
  const revoked = await m.db.from("consent_records").insert(
    purposes.map((purpose) => ({
      tenant_id: m.tenantId,
      contact_id: contact.id,
      channel: parsed.data.channel,
      purpose,
      legal_basis: "consent" as const,
      status: "revoked" as const,
      source: "Descadastro (lista de supressão)",
      evidence: { kind: "suppression", reason: parsed.data.reason },
    })),
  );
  if (revoked.error) return fail(crmMessage(revoked.error.message));
  refresh();
  return { ok: true, message: "Contato descadastrado do canal." };
}

export async function removeSuppression(slug: string, suppressionId: string, reason?: string): Promise<ActionResult> {
  const m = await member(slug, "admin");
  if (!m) return fail("Só administradores removem da lista de supressão.");
  if (!uuid.safeParse(suppressionId).success) return fail("Registro inválido.");
  if (!reason || reason.trim().length < 3) return fail("Informe o motivo.");
  const { data, error } = await m.db.from("suppression_list").delete().eq("tenant_id", m.tenantId).eq("id", suppressionId).select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Registro não encontrado.");
  refresh();
  return { ok: true, message: "Removido da supressão. Isso não recria consentimento." };
}

// --- Importação CSV ------------------------------------------------------------

export type ImportResult = ActionResult & {
  summary?: { total: number; createdContacts: number; updatedContacts: number; createdLeads: number; rejected: number; errors: { line: number; reason: string }[] };
};

export async function importCsv(slug: string, _prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  const m = await member(slug, "manager");
  if (!m) return fail("Só gestores importam contatos.");
  const file = formData.get("file");
  const origin = String(formData.get("origin") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "");
  const consentDeclared = formData.get("consentDeclared") === "on";
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo CSV.");
  if (file.size > MAX_IMPORT_BYTES) return fail("Arquivo maior que 2 MB. Divida em partes.");
  if (!/\.csv$/i.test(file.name)) return fail("Use um arquivo .csv.");
  if (origin.length < 3) return fail("Informe a origem dos contatos (de onde vieram e com qual autorização).");
  if (sourceId && !uuid.safeParse(sourceId).success) return fail("Origem inválida.");
  if (!(await consumeRateLimit(`import:${m.tenantId}:${await clientIpHash()}`, 3600, 20))) return fail("Muitas importações em pouco tempo.");

  const table = parseCsv(await file.text());
  if (table.length - 1 > MAX_IMPORT_ROWS) return fail(`O arquivo passa de ${MAX_IMPORT_ROWS} linhas.`);
  const { rows, rejected, missingColumns } = mapImportRows(table);
  if (missingColumns.length) return fail(`Colunas obrigatórias ausentes: ${missingColumns.join(", ")}.`);
  if (!rows.length) return { ...fail("Nenhuma linha válida."), summary: { total: rejected.length, createdContacts: 0, updatedContacts: 0, createdLeads: 0, rejected: rejected.length, errors: rejected.slice(0, 100) } };

  const { data, error } = await m.db.rpc("import_contacts", {
    p_tenant: m.tenantId,
    p_file_name: file.name.slice(0, 200),
    p_declared_origin: origin.slice(0, 500),
    p_source: (sourceId || null) as unknown as string,
    p_rows: rows,
    p_create_leads: formData.get("createLeads") === "on",
    p_consent_declared: consentDeclared,
    p_rejected: rejected.slice(0, 100),
  });
  if (error || !data) return fail(crmMessage(error?.message));
  refresh();
  return {
    ok: true,
    message: "Importação concluída.",
    summary: {
      total: data.total_rows,
      createdContacts: data.created_contacts,
      updatedContacts: data.updated_contacts,
      createdLeads: data.created_leads,
      rejected: data.rejected_rows,
      errors: rejected.slice(0, 100),
    },
  };
}

// --- Configuração comercial (gestor ou acima) ---------------------------------

const COLORS = ["slate", "blue", "cyan", "violet", "amber", "emerald", "red"] as const;

const stageSchema = z.object({
  name: z.string().trim().min(2, "Nome da etapa muito curto.").max(40),
  color: z.enum(COLORS),
  flag: z.enum(["none", "qualified", "won", "lost"]),
});

function stageFlags(flag: "none" | "qualified" | "won" | "lost") {
  return { is_qualified: flag === "qualified" || flag === "won", is_won: flag === "won", is_lost: flag === "lost" };
}

export async function createStage(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const parsed = stageSchema.safeParse({ name: formData.get("name"), color: formData.get("color"), flag: formData.get("flag") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: pipeline } = await m.db.from("pipelines").select("id, pipeline_stages(position)").eq("tenant_id", m.tenantId).eq("is_default", true).single();
  if (!pipeline) return fail("Pipeline não encontrado.");
  const position = Math.max(-1, ...pipeline.pipeline_stages.map((stage) => stage.position)) + 1;
  const { error } = await m.db.from("pipeline_stages").insert({
    tenant_id: m.tenantId,
    pipeline_id: pipeline.id,
    name: parsed.data.name,
    color: parsed.data.color,
    position,
    ...stageFlags(parsed.data.flag),
  });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Etapa criada." };
}

export async function updateStage(slug: string, stageId: string, input: { name: string; color: string; flag: string }): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const parsed = stageSchema.safeParse(input);
  if (!uuid.safeParse(stageId).success || !parsed.success) return fail(parsed.error?.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await m.db
    .from("pipeline_stages")
    .update({ name: parsed.data.name, color: parsed.data.color, ...stageFlags(parsed.data.flag) })
    .eq("tenant_id", m.tenantId)
    .eq("id", stageId)
    .select("id");
  if (error) return fail(crmMessage(error.message));
  if (!data?.length) return fail("Etapa não encontrada.");
  refresh();
  return { ok: true, message: "Etapa salva." };
}

export async function moveStage(slug: string, stageId: string, direction: "up" | "down"): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(stageId).success) return fail("Etapa inválida.");
  const { data: stage } = await m.db.from("pipeline_stages").select("id, pipeline_id, position").eq("tenant_id", m.tenantId).eq("id", stageId).maybeSingle();
  if (!stage) return fail("Etapa não encontrada.");
  const { data: stages } = await m.db.from("pipeline_stages").select("id, position").eq("tenant_id", m.tenantId).eq("pipeline_id", stage.pipeline_id).order("position");
  const list = stages ?? [];
  const index = list.findIndex((item) => item.id === stageId);
  const swap = list[direction === "up" ? index - 1 : index + 1];
  if (!swap) return { ok: true, message: "" };
  const results = await Promise.all([
    m.db.from("pipeline_stages").update({ position: swap.position }).eq("tenant_id", m.tenantId).eq("id", stage.id),
    m.db.from("pipeline_stages").update({ position: stage.position }).eq("tenant_id", m.tenantId).eq("id", swap.id),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "" };
}

export async function deleteStage(slug: string, stageId: string): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(stageId).success) return fail("Etapa inválida.");
  const { count } = await m.db.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", m.tenantId).eq("stage_id", stageId);
  if (count) return fail(`Há ${count} lead(s) nessa etapa (inclusive excluídos). Mova-os antes.`);
  const { error } = await m.db.from("pipeline_stages").delete().eq("tenant_id", m.tenantId).eq("id", stageId);
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Etapa excluída." };
}

export async function createSource(slug: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  const parsed = z
    .object({ name: z.string().trim().min(2, "Nome muito curto.").max(60), kind: z.enum(["manual", "form", "csv", "ads", "api", "research", "whatsapp_inbound", "referral"]) })
    .safeParse({ name: formData.get("name"), kind: formData.get("kind") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await m.db.from("lead_sources").insert({ tenant_id: m.tenantId, ...parsed.data });
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Origem criada." };
}

export async function setSourceActive(slug: string, sourceId: string, active: boolean): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(sourceId).success) return fail("Origem inválida.");
  const { error } = await m.db.from("lead_sources").update({ active }).eq("tenant_id", m.tenantId).eq("id", sourceId);
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: active ? "Origem ativada." : "Origem desativada." };
}

export async function deleteTag(slug: string, tagId: string): Promise<ActionResult> {
  const m = await member(slug, "manager");
  if (!m) return fail(NO_PERMISSION);
  if (!uuid.safeParse(tagId).success) return fail("Tag inválida.");
  const { error } = await m.db.from("tags").delete().eq("tenant_id", m.tenantId).eq("id", tagId);
  if (error) return fail(crmMessage(error.message));
  refresh();
  return { ok: true, message: "Tag excluída." };
}
