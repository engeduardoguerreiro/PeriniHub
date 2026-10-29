import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

// CRM contra o Supabase "AI Sales": isolamento entre empresas nas tabelas
// novas, visibilidade do vendedor, integridade entre empresas (FK composta),
// deduplicação, consentimento imutável, supressão, importação e indicadores.

const fx = createFixtures("crm");

let ownerA: TestUser;
let managerA: TestUser;
let salesA: TestUser;
let sales2A: TestUser;
let viewerA: TestUser;
let ownerB: TestUser;
let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };
let pipelineA: { id: string; stages: { id: string; name: string; is_qualified: boolean }[] };
let pipelineB: { id: string; stages: { id: string }[] };

async function loadPipeline(tenant: string) {
  const { data } = await fx.service.from("pipelines").select("id, pipeline_stages(id, name, position, is_qualified)").eq("tenant_id", tenant).eq("is_default", true).single();
  const stages = [...(data?.pipeline_stages ?? [])].sort((a, b) => a.position - b.position);
  return { id: data!.id, stages };
}

async function createContact(user: TestUser, tenant: string, fields: { full_name: string; phone_e164?: string; email?: string }) {
  const { data, error } = await user.client.from("contacts").insert({ tenant_id: tenant, ...fields }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function createLead(user: TestUser, tenant: string, contactId: string, owner: string | null, pipeline: { id: string; stages: { id: string }[] } = pipelineA) {
  const { data, error } = await user.client
    .from("leads")
    .insert({ tenant_id: tenant, contact_id: contactId, pipeline_id: pipeline.id, stage_id: pipeline.stages[0].id, owner_user_id: owner })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [ownerA, managerA, salesA, sales2A, viewerA, ownerB] = await Promise.all(
    ["owner-a", "manager-a", "sales-a", "sales2-a", "viewer-a", "owner-b"].map(fx.createUser),
  );
  orgA = await fx.createOrg("crm-a", ownerA);
  orgB = await fx.createOrg("crm-b", ownerB);
  await fx.addMember(orgA.id, ownerA, managerA, "manager");
  await fx.addMember(orgA.id, ownerA, salesA, "sales");
  await fx.addMember(orgA.id, ownerA, sales2A, "sales");
  await fx.addMember(orgA.id, ownerA, viewerA, "viewer");
  pipelineA = await loadPipeline(orgA.id);
  pipelineB = await loadPipeline(orgB.id);
});

afterAll(() => fx.cleanup());

describe("padrões da empresa", () => {
  it("toda empresa nova ganha pipeline com 9 etapas e origens padrão", async () => {
    expect(pipelineA.stages.map((stage) => stage.name)).toEqual([
      "Novo", "Em análise", "Contato autorizado", "Em atendimento", "Qualificado", "Proposta", "Negociação", "Ganho", "Perdido",
    ]);
    const { count } = await fx.service.from("lead_sources").select("*", { count: "exact", head: true }).eq("tenant_id", orgB.id);
    // 5 da Fase 2 + "Prospecção (dados públicos)" da Fase 6.
    expect(count).toBe(6);
  });
});

describe("isolamento entre empresas", () => {
  it("dados de CRM da B não aparecem para a A", async () => {
    const contactB = await createContact(ownerB, orgB.id, { full_name: "Contato B", phone_e164: "+5511900000001" });
    await createLead(ownerB, orgB.id, contactB, ownerB.id, pipelineB);
    for (const table of ["contacts", "leads", "pipelines", "pipeline_stages", "lead_sources", "activities", "consent_records"] as const) {
      expect((await ownerA.client.from(table).select("id").eq("tenant_id", orgB.id)).data).toEqual([]);
    }
  });

  it("FK composta: lead da A não aponta para contato, etapa ou responsável da B — nem com a secret key", async () => {
    const contactB = await createContact(ownerB, orgB.id, { full_name: "Outro B" });
    const crossContact = await fx.service
      .from("leads")
      .insert({ tenant_id: orgA.id, contact_id: contactB, pipeline_id: pipelineA.id, stage_id: pipelineA.stages[0].id });
    expect(crossContact.error?.code).toBe("23503");

    const contactA = await createContact(ownerA, orgA.id, { full_name: "Contato A" });
    const crossStage = await fx.service
      .from("leads")
      .insert({ tenant_id: orgA.id, contact_id: contactA, pipeline_id: pipelineA.id, stage_id: pipelineB.stages[0].id });
    expect(crossStage.error?.code).toBe("23503");

    const crossOwner = await fx.service
      .from("leads")
      .insert({ tenant_id: orgA.id, contact_id: contactA, pipeline_id: pipelineA.id, stage_id: pipelineA.stages[0].id, owner_user_id: ownerB.id });
    expect(crossOwner.error?.code).toBe("23503");
  });

  it("membro da A não grava na B (insert com tenant_id da B é recusado)", async () => {
    const insert = await ownerA.client.from("contacts").insert({ tenant_id: orgB.id, full_name: "Invasor" });
    expect(insert.error).not.toBeNull();
  });
});

describe("papéis e visibilidade", () => {
  it("viewer só lê; vendedor cria contatos e leads", async () => {
    expect((await viewerA.client.from("contacts").insert({ tenant_id: orgA.id, full_name: "Pelo viewer" })).error).not.toBeNull();
    const contact = await createContact(salesA, orgA.id, { full_name: "Pelo vendedor" });
    expect(await createLead(salesA, orgA.id, contact, salesA.id)).toBeTruthy();
  });

  it("com visibilidade 'atribuídos', vendedor não vê nem altera lead de outro; gestor vê todos", async () => {
    const contact = await createContact(managerA, orgA.id, { full_name: "Lead do vendedor 2" });
    const lead = await createLead(managerA, orgA.id, contact, sales2A.id);
    expect((await salesA.client.from("leads").select("id").eq("id", lead)).data).toHaveLength(1);

    await ownerA.client.from("organization_settings").update({ sales_visibility: "assigned" }).eq("tenant_id", orgA.id);
    expect((await salesA.client.from("leads").select("id").eq("id", lead)).data).toEqual([]);
    await salesA.client.from("leads").update({ qualification: "hot" }).eq("id", lead);
    expect((await fx.service.from("leads").select("qualification").eq("id", lead).single()).data?.qualification).toBe("unknown");
    expect((await sales2A.client.from("leads").select("id").eq("id", lead)).data).toHaveLength(1);
    expect((await managerA.client.from("leads").select("id").eq("id", lead)).data).toHaveLength(1);
    // Atividades e tarefas do lead escondido também somem.
    expect((await salesA.client.from("activities").select("id").eq("lead_id", lead)).data).toEqual([]);
    await ownerA.client.from("organization_settings").update({ sales_visibility: "all" }).eq("tenant_id", orgA.id);
  });

  it("exclusão lógica exige gestor; vendedor não apaga", async () => {
    const contact = await createContact(salesA, orgA.id, { full_name: "Para apagar" });
    const bySales = await salesA.client.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", contact);
    expect(bySales.error?.message).toContain("delete_requires_manager");
    const byManager = await managerA.client.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", contact);
    expect(byManager.error).toBeNull();
    expect((await salesA.client.from("contacts").select("id").eq("id", contact)).data).toEqual([]);
    const { data: audit } = await fx.service.from("audit_logs").select("action, actor_id").eq("entity_id", contact);
    expect(audit).toContainEqual({ action: "soft_delete", actor_id: managerA.id });
  });

  it("só gestor altera etapas do pipeline", async () => {
    const stage = pipelineA.stages[1].id;
    await salesA.client.from("pipeline_stages").update({ name: "Invadida" }).eq("id", stage);
    expect((await fx.service.from("pipeline_stages").select("name").eq("id", stage).single()).data?.name).toBe("Em análise");
  });
});

describe("deduplicação e integridade", () => {
  it("mesmo telefone ou e-mail não cria dois contatos na mesma empresa (mas pode em outra)", async () => {
    await createContact(ownerA, orgA.id, { full_name: "Original", phone_e164: "+5511987654321", email: "Dup@Teste.com" });
    const phone = await ownerA.client.from("contacts").insert({ tenant_id: orgA.id, full_name: "Dup tel", phone_e164: "+5511987654321" });
    expect(phone.error?.code).toBe("23505");
    const email = await ownerA.client.from("contacts").insert({ tenant_id: orgA.id, full_name: "Dup mail", email: "dup@teste.COM" });
    expect(email.error?.code).toBe("23505");
    expect(await createContact(ownerB, orgB.id, { full_name: "Mesmo tel na B", phone_e164: "+5511987654321" })).toBeTruthy();
  });

  it("mudança de etapa gera atividade com autor e atualiza a data da etapa", async () => {
    const contact = await createContact(salesA, orgA.id, { full_name: "Mover etapa" });
    const lead = await createLead(salesA, orgA.id, contact, salesA.id);
    await salesA.client.from("leads").update({ stage_id: pipelineA.stages[4].id }).eq("id", lead);
    const { data } = await fx.service.from("activities").select("kind, actor_id, body").eq("lead_id", lead).eq("kind", "stage_change");
    expect(data).toEqual([{ kind: "stage_change", actor_id: salesA.id, body: "Etapa: Novo → Qualificado" }]);
  });

  it("autor de atividade e consentimento vem da sessão, não do cliente", async () => {
    const contact = await createContact(salesA, orgA.id, { full_name: "Autoria" });
    await salesA.client.from("activities").insert({ tenant_id: orgA.id, contact_id: contact, kind: "note", body: "nota", actor_id: ownerA.id });
    const { data } = await fx.service.from("activities").select("actor_id").eq("contact_id", contact).eq("kind", "note").single();
    expect(data?.actor_id).toBe(salesA.id);
    const forged = await salesA.client.from("activities").insert({ tenant_id: orgA.id, contact_id: contact, kind: "stage_change", body: "forjada" });
    expect(forged.error).not.toBeNull();
  });
});

describe("consentimento e supressão", () => {
  it("consentimento é imutável: não se edita nem apaga, revogação é um registro novo", async () => {
    const contact = await createContact(salesA, orgA.id, { full_name: "Consentimento", phone_e164: "+5511911112222" });
    const base = { tenant_id: orgA.id, contact_id: contact, channel: "whatsapp" as const, purpose: "marketing" as const, legal_basis: "consent" as const };
    const { data: granted } = await salesA.client.from("consent_records").insert({ ...base, status: "granted", source: "Formulário" }).select("id").single();
    await salesA.client.from("consent_records").update({ status: "revoked" }).eq("id", granted!.id);
    await ownerA.client.from("consent_records").delete().eq("id", granted!.id);
    expect((await fx.service.from("consent_records").select("status").eq("id", granted!.id).single()).data?.status).toBe("granted");

    let current = await salesA.client.from("current_consents").select("is_valid").eq("contact_id", contact).single();
    expect(current.data?.is_valid).toBe(true);
    await salesA.client.from("consent_records").insert({ ...base, status: "revoked", source: "Pedido do titular" });
    current = await salesA.client.from("current_consents").select("is_valid, status").eq("contact_id", contact).single();
    expect(current.data).toEqual({ is_valid: false, status: "revoked" });
  });

  it("supressão: vendedor registra, não remove; admin remove e fica auditado", async () => {
    const insert = await salesA.client.from("suppression_list").insert({ tenant_id: orgA.id, channel: "whatsapp", identifier: "+5511933334444", reason: "opt_out", source: "teste" }).select("id").single();
    expect(insert.error).toBeNull();
    await salesA.client.from("suppression_list").delete().eq("id", insert.data!.id);
    expect((await fx.service.from("suppression_list").select("id").eq("id", insert.data!.id)).data).toHaveLength(1);
    const dup = await managerA.client.from("suppression_list").insert({ tenant_id: orgA.id, channel: "whatsapp", identifier: "+5511933334444", reason: "complaint", source: "teste" });
    expect(dup.error?.code).toBe("23505");
    await ownerA.client.from("suppression_list").delete().eq("id", insert.data!.id);
    const { data } = await fx.service.from("audit_logs").select("action").eq("entity_type", "suppression_list").eq("entity_id", insert.data!.id);
    expect(data?.map((row) => row.action).sort()).toEqual(["delete", "insert"]);
  });
});

describe("importação", () => {
  it("vendedor não importa; gestor importa com deduplicação, tags, leads e consentimento declarado", async () => {
    const rows = [
      { full_name: "Import 1", phone_e164: "+5521999990001", email: "imp1@teste.com", company_name: "Empresa Import", tags: ["Feira 2026"], consent_whatsapp: true },
      { full_name: "Import 1 de novo", phone_e164: "+5521999990001", job_title: "Compras" },
      { full_name: "Import 2", email: "imp2@teste.com", company_name: "empresa import" },
    ];
    const args = { p_tenant: orgA.id, p_file_name: "teste.csv", p_declared_origin: "Lista da feira X, com autorização", p_source: null as unknown as string, p_rows: rows, p_create_leads: true, p_consent_declared: true, p_rejected: [{ line: 5, reason: "sem telefone nem e-mail" }] };
    expect((await salesA.client.rpc("import_contacts", args)).error?.message).toContain("not_authorized");

    const { data, error } = await managerA.client.rpc("import_contacts", args);
    expect(error).toBeNull();
    expect(data).toMatchObject({ total_rows: 4, created_contacts: 2, updated_contacts: 1, created_leads: 2, rejected_rows: 1 });

    const { data: contact } = await fx.service.from("contacts").select("id, job_title, company_id").eq("tenant_id", orgA.id).eq("phone_e164", "+5521999990001").single();
    expect(contact?.job_title).toBe("Compras");
    const { count: companies } = await fx.service.from("companies").select("*", { count: "exact", head: true }).eq("tenant_id", orgA.id).ilike("name", "empresa import");
    expect(companies).toBe(1);
    const { data: consent } = await fx.service.from("current_consents").select("is_valid").eq("contact_id", contact!.id).single();
    expect(consent?.is_valid).toBe(true);
    const { data: tags } = await fx.service.from("contact_tags").select("tags(name)").eq("contact_id", contact!.id);
    expect(tags?.map((row) => row.tags?.name)).toEqual(["Feira 2026"]);
  });

  it("sem declaração de consentimento, a coluna de consentimento é ignorada", async () => {
    const { data } = await managerA.client.rpc("import_contacts", {
      p_tenant: orgA.id, p_file_name: "sem-consentimento.csv", p_declared_origin: "Cadastro antigo", p_source: null as unknown as string,
      p_rows: [{ full_name: "Sem consent", phone_e164: "+5521999990009", consent_whatsapp: true }], p_create_leads: false, p_consent_declared: false,
    });
    const { data: contact } = await fx.service.from("contacts").select("id").eq("tenant_id", orgA.id).eq("phone_e164", "+5521999990009").single();
    expect((await fx.service.from("consent_records").select("id").eq("contact_id", contact!.id)).data).toEqual([]);
    expect(data?.created_leads).toBe(0);
  });
});

describe("indicadores e exportação", () => {
  it("dashboard conta só a empresa do usuário e respeita a visibilidade do vendedor", async () => {
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const { data: asOwner } = await ownerA.client.rpc("crm_dashboard", { p_tenant: orgA.id, p_from: from, p_to: to });
    const { count } = await fx.service.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", orgA.id).is("deleted_at", null);
    expect((asOwner as { leads_created: number }).leads_created).toBe(count);
    expect((asOwner as { leads_qualified: number }).leads_qualified).toBeGreaterThanOrEqual(1);

    const { data: crossTenant } = await ownerA.client.rpc("crm_dashboard", { p_tenant: orgB.id, p_from: from, p_to: to });
    expect((crossTenant as { leads_created: number }).leads_created).toBe(0);

    await ownerA.client.from("organization_settings").update({ sales_visibility: "assigned" }).eq("tenant_id", orgA.id);
    const { data: asSales } = await salesA.client.rpc("crm_dashboard", { p_tenant: orgA.id, p_from: from, p_to: to });
    const { count: own } = await fx.service.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", orgA.id).eq("owner_user_id", salesA.id).is("deleted_at", null);
    expect((asSales as { leads_created: number }).leads_created).toBe(own);
    await ownerA.client.from("organization_settings").update({ sales_visibility: "all" }).eq("tenant_id", orgA.id);
  });

  it("exportação só por gestor e sempre auditada", async () => {
    expect((await salesA.client.rpc("record_export", { p_tenant: orgA.id, p_entity: "leads", p_rows: 3, p_filters: {} })).error).not.toBeNull();
    expect((await managerA.client.rpc("record_export", { p_tenant: orgA.id, p_entity: "leads", p_rows: 3, p_filters: { q: "x" } })).error).toBeNull();
    const { data } = await fx.service.from("audit_logs").select("actor_id, diff").eq("tenant_id", orgA.id).eq("action", "export");
    expect(data).toContainEqual({ actor_id: managerA.id, diff: { rows: 3, filters: { q: "x" } } });
  });
});
