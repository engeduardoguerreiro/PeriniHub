import "server-only";

import { createSalesSessionClient } from "@/lib/supabase/sales-server";
import type { Database } from "@/lib/supabase/sales.types";

import { PAGE_SIZE } from "./page-size";

// Consultas do CRM. Sempre com a sessão do usuário (RLS) e com o tenant_id
// explícito no filtro: defesa dupla contra mistura de empresas.

export { PAGE_SIZE };

type Enums = Database["public"]["Enums"];

/** Termo de busca seguro para filtros do PostgREST (sem vírgulas, parênteses ou curingas). */
export function searchTerm(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function pageNumber(value: unknown) {
  const page = Number(typeof value === "string" ? value : 1);
  return Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}

export type CrmOptions = Awaited<ReturnType<typeof loadCrmOptions>>;

/** Etapas do pipeline padrão, origens, tags e membros (para filtros e formulários). */
export async function loadCrmOptions(tenantId: string) {
  const db = await createSalesSessionClient();
  const [pipeline, sources, tags, members] = await Promise.all([
    db
      .from("pipelines")
      .select("id, name, pipeline_stages(id, name, position, color, is_qualified, is_won, is_lost)")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle(),
    db.from("lead_sources").select("id, name, kind, active").eq("tenant_id", tenantId).order("name"),
    db.from("tags").select("id, name, color").eq("tenant_id", tenantId).order("name"),
    db.from("organization_members").select("user_id, role").eq("tenant_id", tenantId).eq("status", "active"),
  ]);
  const ids = (members.data ?? []).map((member) => member.user_id);
  const { data: profiles } = ids.length ? await db.from("user_profiles").select("user_id, email, full_name").in("user_id", ids) : { data: [] };
  const people = (members.data ?? [])
    .filter((member) => member.role !== "viewer")
    .map((member) => {
      const profile = profiles?.find((item) => item.user_id === member.user_id);
      return { id: member.user_id, name: profile?.full_name || profile?.email || "Membro" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    pipeline: pipeline.data ? { id: pipeline.data.id, name: pipeline.data.name } : null,
    stages: [...(pipeline.data?.pipeline_stages ?? [])].sort((a, b) => a.position - b.position),
    sources: sources.data ?? [],
    tags: tags.data ?? [],
    people,
  };
}

export type LeadFilters = {
  q: string;
  stage: string;
  source: string;
  owner: string;
  qualification: string;
  page: number;
};

const LEAD_LIST_SELECT =
  "id, title, qualification, score, stage_id, owner_user_id, created_at, stage_changed_at, lead_source_id, contact:contacts!inner(id, full_name, phone_e164, email), company:companies(id, name)";

export async function listLeads(tenantId: string, filters: LeadFilters) {
  const db = await createSalesSessionClient();
  let query = db
    .from("leads")
    .select(LEAD_LIST_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`full_name.ilike.${term},email_normalized.ilike.${term},phone_e164.ilike.${term}`, { referencedTable: "contacts" });
  }
  if (filters.stage) query = query.eq("stage_id", filters.stage);
  if (filters.source) query = query.eq("lead_source_id", filters.source);
  if (filters.owner === "none") query = query.is("owner_user_id", null);
  else if (filters.owner) query = query.eq("owner_user_id", filters.owner);
  if (filters.qualification) query = query.eq("qualification", filters.qualification as Enums["lead_qualification"]);
  const { data, count, error } = await query;
  if (error) throw new Error(`Falha ao listar leads: ${error.message}`);
  return { leads: data ?? [], total: count ?? 0 };
}

export async function getLead(tenantId: string, leadId: string) {
  const db = await createSalesSessionClient();
  const { data: lead } = await db
    .from("leads")
    .select("*, contact:contacts(*), company:companies(id, name, document, city, state)")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!lead) return null;
  const contactId = lead.contact_id;
  const [activities, tasks, opportunities, consents, suppressions] = await Promise.all([
    db
      .from("activities")
      .select("id, kind, body, actor_type, actor_id, created_at")
      .eq("tenant_id", tenantId)
      .or(contactId ? `lead_id.eq.${lead.id},contact_id.eq.${contactId}` : `lead_id.eq.${lead.id}`)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("tasks").select("id, title, due_at, status, assignee_user_id").eq("tenant_id", tenantId).eq("lead_id", lead.id).order("status").order("due_at", { nullsFirst: false }),
    db.from("opportunities").select("id, title, amount_cents, status, expected_close_date, lost_reason, closed_at").eq("tenant_id", tenantId).eq("lead_id", lead.id).order("created_at"),
    contactId ? db.from("current_consents").select("id, channel, purpose, legal_basis, status, source, is_valid, recorded_at").eq("tenant_id", tenantId).eq("contact_id", contactId) : Promise.resolve({ data: [] }),
    suppressionsFor(tenantId, lead.contact?.phone_e164 ?? null, lead.contact?.email_normalized ?? null),
  ]);
  return {
    lead,
    activities: activities.data ?? [],
    tasks: tasks.data ?? [],
    opportunities: opportunities.data ?? [],
    consents: consents.data ?? [],
    suppressions,
  };
}

export async function suppressionsFor(tenantId: string, phone: string | null, email: string | null) {
  const identifiers = [phone, email].filter((value): value is string => Boolean(value));
  if (!identifiers.length) return [];
  const db = await createSalesSessionClient();
  const { data } = await db.from("suppression_list").select("id, channel, identifier, reason, source, created_at").eq("tenant_id", tenantId).in("identifier", identifiers);
  return data ?? [];
}

export async function listContacts(tenantId: string, q: string, page: number) {
  const db = await createSalesSessionClient();
  let query = db
    .from("contacts")
    .select("id, full_name, phone_e164, email, job_title, city, state, created_at, company:companies(id, name), contact_tags(tags(id, name, color))", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,email_normalized.ilike.%${q}%,phone_e164.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw new Error(`Falha ao listar contatos: ${error.message}`);
  return { contacts: data ?? [], total: count ?? 0 };
}

export async function getContact(tenantId: string, contactId: string) {
  const db = await createSalesSessionClient();
  const { data: contact } = await db
    .from("contacts")
    .select("*, company:companies(id, name), contact_tags(tags(id, name, color))")
    .eq("tenant_id", tenantId)
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!contact) return null;
  const [leads, history, activities, suppressions] = await Promise.all([
    db.from("leads").select("id, title, stage_id, created_at").eq("tenant_id", tenantId).eq("contact_id", contactId).is("deleted_at", null).order("created_at", { ascending: false }),
    db
      .from("consent_records")
      .select("id, channel, purpose, legal_basis, status, source, evidence, recorded_at")
      .eq("tenant_id", tenantId)
      .eq("contact_id", contactId)
      .order("recorded_at", { ascending: false }),
    db.from("activities").select("id, kind, body, actor_type, actor_id, created_at").eq("tenant_id", tenantId).eq("contact_id", contactId).order("created_at", { ascending: false }).limit(50),
    suppressionsFor(tenantId, contact.phone_e164, contact.email_normalized),
  ]);
  return { contact, leads: leads.data ?? [], consentHistory: history.data ?? [], activities: activities.data ?? [], suppressions };
}

export async function listCompanies(tenantId: string, q: string, page: number) {
  const db = await createSalesSessionClient();
  let query = db
    .from("companies")
    .select("id, name, document, city, state, website, created_at, contacts(count)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,document.ilike.%${q.replace(/\D/g, "") || q}%`);
  const { data, count, error } = await query;
  if (error) throw new Error(`Falha ao listar empresas: ${error.message}`);
  return { companies: data ?? [], total: count ?? 0 };
}

export async function getCompany(tenantId: string, companyId: string) {
  const db = await createSalesSessionClient();
  const { data: company } = await db.from("companies").select("*").eq("tenant_id", tenantId).eq("id", companyId).is("deleted_at", null).maybeSingle();
  if (!company) return null;
  const [contacts, leads] = await Promise.all([
    db.from("contacts").select("id, full_name, phone_e164, email, job_title").eq("tenant_id", tenantId).eq("company_id", companyId).is("deleted_at", null).order("full_name"),
    db.from("leads").select("id, title, stage_id, created_at, contact:contacts(full_name)").eq("tenant_id", tenantId).eq("company_id", companyId).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  return { company, contacts: contacts.data ?? [], leads: leads.data ?? [] };
}

/** Kanban: até 50 leads por etapa, os mais recentes primeiro. */
export async function loadBoard(tenantId: string, stageIds: string[], owner: string) {
  const db = await createSalesSessionClient();
  const results = await Promise.all(
    stageIds.map(async (stageId) => {
      let query = db
        .from("leads")
        .select("id, title, qualification, score, owner_user_id, stage_changed_at, contact:contacts(full_name), company:companies(name)", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("stage_id", stageId)
        .is("deleted_at", null)
        .order("stage_changed_at", { ascending: false })
        .limit(50);
      if (owner) query = query.eq("owner_user_id", owner);
      const { data, count } = await query;
      return [stageId, { leads: data ?? [], total: count ?? 0 }] as const;
    }),
  );
  return Object.fromEntries(results);
}

/** Nomes de quem fez cada atividade (perfis visíveis pelo RLS). */
export async function actorNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map<string, string>();
  const db = await createSalesSessionClient();
  const { data } = await db.from("user_profiles").select("user_id, email, full_name").in("user_id", unique);
  return new Map((data ?? []).map((profile) => [profile.user_id, profile.full_name || profile.email]));
}
