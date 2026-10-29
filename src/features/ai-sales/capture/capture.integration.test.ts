import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

// Captação e enriquecimento contra o Supabase "AI Sales" (dev). Aceite da
// Fase 6: telefone descoberto nunca marca autorização; toda informação tem
// fonte e data; formulário confere versão do consentimento e estado.

const fx = createFixtures("cap");

let ownerA: TestUser;
let salesA: TestUser;
let viewerA: TestUser;
let ownerB: TestUser;
let orgA: { id: string };
let orgB: { id: string };
let form: { id: string; public_key: string };

const phone = () => `+55119${randomBytes(4).readUInt32BE() % 100_000_000}`.padEnd(14, "0");
const hash = () => randomBytes(32).toString("hex");

function submit(overrides: Record<string, unknown> = {}) {
  return fx.service.rpc("capture_form_submit", {
    p_public_key: form.public_key,
    p_full_name: "Maria Teste",
    p_phone_e164: null,
    p_email: null,
    p_company: null,
    p_job_title: null,
    p_message: null,
    p_consent: false,
    p_consent_version: 1,
    p_payload_hash: hash(),
    p_ip_hash: "a".repeat(32),
    p_user_agent: "vitest",
    ...overrides,
  } as never);
}

type Submitted = { submission_id: string; contact_id: string; lead_id: string };

beforeAll(async () => {
  [ownerA, salesA, viewerA, ownerB] = await Promise.all(["owner-a", "sales-a", "viewer-a", "owner-b"].map(fx.createUser));
  orgA = await fx.createOrg("cap-a", ownerA);
  orgB = await fx.createOrg("cap-b", ownerB);
  await fx.addMember(orgA.id, ownerA, salesA, "sales");
  await fx.addMember(orgA.id, ownerA, viewerA, "viewer");
  const { data, error } = await ownerA.client
    .from("capture_forms")
    .insert({
      tenant_id: orgA.id,
      name: "Site",
      headline: "Fale com a gente",
      fields: ["phone", "email", "company", "message"],
      consent_text: "Autorizo o contato pelo WhatsApp para retornar este pedido.",
      consent_channels: ["whatsapp", "email"],
      consent_purposes: ["sales_followup", "marketing"],
      status: "active",
    })
    .select("id, public_key")
    .single();
  if (error) throw error;
  form = data;
});
afterAll(() => fx.cleanup());

describe("formulário público", () => {
  it("com consentimento: contato, consentimentos com evidência, lead autorizado e proveniência", async () => {
    const number = phone();
    const { data, error } = await submit({ p_phone_e164: number, p_email: "maria.cap@teste.local", p_company: "Padaria Teste", p_message: "Quero orçamento", p_consent: true });
    expect(error).toBeNull();
    const result = data as unknown as Submitted;

    const { data: contact } = await fx.service.from("contacts").select("*").eq("id", result.contact_id).single();
    expect(contact).toMatchObject({ phone_e164: number, email: "maria.cap@teste.local" });
    const provenance = contact!.provenance as Record<string, { source: string; at: string; submission_id: string }>;
    for (const field of ["full_name", "phone_e164", "email", "company_id"]) {
      expect(provenance[field]).toMatchObject({ source: "form", form_id: form.id, submission_id: result.submission_id });
      expect(Date.parse(provenance[field].at)).not.toBeNaN();
    }

    const { data: consents } = await fx.service.from("consent_records").select("channel, purpose, legal_basis, status, evidence").eq("contact_id", result.contact_id);
    expect(consents).toHaveLength(4); // 2 canais × 2 finalidades
    const { data: version } = await fx.service.from("capture_form_consent_versions").select("text_hash").eq("form_id", form.id).eq("version", 1).single();
    for (const consent of consents!) {
      expect(consent).toMatchObject({ legal_basis: "consent", status: "granted" });
      expect(consent.evidence).toMatchObject({ kind: "form_submission", submission_id: result.submission_id, text_version: 1, text_hash: version!.text_hash });
    }

    const { data: lead } = await fx.service.from("leads").select("discovery_stage, lead_source_id, company_id").eq("id", result.lead_id).single();
    expect(lead!.discovery_stage).toBe("contact_authorized");
    expect(lead!.company_id).toBe(contact!.company_id);
    const { data: source } = await fx.service.from("lead_sources").select("kind").eq("id", lead!.lead_source_id!).single();
    expect(source!.kind).toBe("form");

    const { data: submission } = await fx.service.from("form_submissions").select("consent_given, consent_version, fields_received, lead_id").eq("id", result.submission_id).single();
    expect(submission).toMatchObject({ consent_given: true, consent_version: 1, lead_id: result.lead_id });
    expect(submission!.fields_received.sort()).toEqual(["company", "email", "message", "phone"]);
  });

  it("sem consentimento: nenhum registro de consentimento e lead só 'contato encontrado'", async () => {
    const { data } = await submit({ p_phone_e164: phone() });
    const result = data as unknown as Submitted;
    const { count } = await fx.service.from("consent_records").select("id", { count: "exact", head: true }).eq("contact_id", result.contact_id);
    expect(count).toBe(0);
    const { data: lead } = await fx.service.from("leads").select("discovery_stage").eq("id", result.lead_id).single();
    expect(lead!.discovery_stage).toBe("contact_found");
  });

  it("reenvio do mesmo telefone reaproveita contato e lead; identificador novo não é gravado, vira nota", async () => {
    const number = phone();
    const first = (await submit({ p_phone_e164: number, p_full_name: "Primeiro Nome" })).data as unknown as Submitted;
    const second = (await submit({ p_phone_e164: number, p_full_name: "Outro Nome", p_email: "reenvio.cap@teste.local", p_consent: true })).data as unknown as Submitted;
    expect(second.contact_id).toBe(first.contact_id);
    expect(second.lead_id).toBe(first.lead_id);
    const { data: contact } = await fx.service.from("contacts").select("full_name, email").eq("id", first.contact_id).single();
    expect(contact).toEqual({ full_name: "Primeiro Nome", email: null });
    // Consentimento só no telefone que casou com o cadastro.
    const { data: consents } = await fx.service.from("consent_records").select("channel").eq("contact_id", first.contact_id);
    expect(new Set(consents!.map((row) => row.channel))).toEqual(new Set(["whatsapp"]));
    const { data: note } = await fx.service.from("activities").select("body").eq("lead_id", first.lead_id).ilike("body", "%dados de contato diferentes%");
    expect(note).toHaveLength(1);
    const { data: lead } = await fx.service.from("leads").select("discovery_stage").eq("id", first.lead_id).single();
    expect(lead!.discovery_stage).toBe("contact_authorized");
  });

  it("anônimo com o e-mail de um cliente não põe o próprio telefone no contato nem gera consentimento", async () => {
    const { data: victim } = await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: "Cliente Real", email: "cliente.real.cap@teste.local" }).select("id").single();
    const attacker = phone();
    const { error } = await submit({ p_email: "cliente.real.cap@teste.local", p_phone_e164: attacker, p_consent: true });
    expect(error).toBeNull();
    const { data: after } = await fx.service.from("contacts").select("phone_e164").eq("id", victim!.id).single();
    expect(after!.phone_e164).toBeNull();
    const { data: consents } = await fx.service.from("consent_records").select("channel").eq("contact_id", victim!.id);
    // O e-mail casou: só o canal e-mail pode ter registro; WhatsApp nunca.
    expect(consents!.some((row) => row.channel === "whatsapp")).toBe(false);
  });

  it("recusa versão antiga do texto, formulário pausado e envio sem contato", async () => {
    expect((await submit({ p_phone_e164: phone() , p_consent_version: 99 })).error?.message).toMatch(/consent_version_changed/);
    expect((await submit({})).error?.message).toMatch(/contact_required/);

    const changed = await ownerA.client.from("capture_forms").update({ consent_text: "Autorizo o contato pelo WhatsApp e por e-mail (texto novo)." }).eq("id", form.id).select("consent_version").single();
    expect(changed.data!.consent_version).toBe(2);
    expect((await submit({ p_phone_e164: phone(), p_consent_version: 1 })).error?.message).toMatch(/consent_version_changed/);
    expect((await submit({ p_phone_e164: phone(), p_consent_version: 2 })).error).toBeNull();
    const { data: versions } = await fx.service.from("capture_form_consent_versions").select("version").eq("form_id", form.id).order("version");
    expect(versions!.map((row) => row.version)).toEqual([1, 2]);

    // Mudar só o título não cria versão nova.
    const renamed = await ownerA.client.from("capture_forms").update({ headline: "Novo título" }).eq("id", form.id).select("consent_version").single();
    expect(renamed.data!.consent_version).toBe(2);

    await ownerA.client.from("capture_forms").update({ status: "paused" }).eq("id", form.id);
    expect((await submit({ p_phone_e164: phone(), p_consent_version: 2 })).error?.message).toMatch(/form_unavailable/);
    await ownerA.client.from("capture_forms").update({ status: "active" }).eq("id", form.id);
  });

  it("contador de envios não é editável pelo usuário", async () => {
    const { data: before } = await fx.service.from("capture_forms").select("submissions_count").eq("id", form.id).single();
    await ownerA.client.from("capture_forms").update({ submissions_count: 999_999 }).eq("id", form.id);
    const { data: after } = await fx.service.from("capture_forms").select("submissions_count").eq("id", form.id).single();
    expect(after!.submissions_count).toBe(before!.submissions_count);
  });
});

describe("permissões da captação", () => {
  it("vendedor não cria formulário; outra empresa e anônimo não leem", async () => {
    const created = await salesA.client.from("capture_forms").insert({ tenant_id: orgA.id, name: "X", headline: "X", consent_text: "x".repeat(30) });
    expect(created.error).not.toBeNull();
    for (const table of ["capture_forms", "form_submissions", "capture_form_consent_versions"] as const) {
      const other = await ownerB.client.from(table).select("tenant_id").eq("tenant_id", orgA.id);
      expect(other.data ?? []).toHaveLength(0);
      const anon = await fx.anon.from(table).select("tenant_id").limit(1);
      expect(anon.data ?? []).toHaveLength(0);
    }
    const mine = await salesA.client.from("form_submissions").select("id").eq("tenant_id", orgA.id);
    expect(mine.data!.length).toBeGreaterThan(0);
  });
});

describe("estágio de descoberta", () => {
  it("é calculado: empresa → contato → autorizado (e volta ao revogar); valor manual é ignorado", async () => {
    const { data: stage } = await fx.service.from("pipeline_stages").select("id, pipeline_id").eq("tenant_id", orgA.id).order("position").limit(1).single();
    const { data: company } = await salesA.client.from("companies").insert({ tenant_id: orgA.id, name: "Empresa Prospect" }).select("id").single();
    const { data: lead } = await salesA.client
      .from("leads")
      .insert({ tenant_id: orgA.id, company_id: company!.id, pipeline_id: stage!.pipeline_id, stage_id: stage!.id, discovery_stage: "qualified_opportunity" })
      .select("id, discovery_stage")
      .single();
    expect(lead!.discovery_stage).toBe("company_identified");

    // Telefone descoberto (sem consentimento) não autoriza.
    const { data: contact } = await salesA.client.from("contacts").insert({ tenant_id: orgA.id, full_name: "Dono", phone_e164: phone(), company_id: company!.id }).select("id").single();
    const forced = await salesA.client.from("leads").update({ contact_id: contact!.id, discovery_stage: "contact_authorized" }).eq("id", lead!.id).select("discovery_stage").single();
    expect(forced.data!.discovery_stage).toBe("contact_found");

    await salesA.client.from("consent_records").insert({ tenant_id: orgA.id, contact_id: contact!.id, channel: "whatsapp", purpose: "sales_followup", legal_basis: "consent", status: "granted", source: "Pedido por telefone" });
    const authorized = await fx.service.from("leads").select("discovery_stage").eq("id", lead!.id).single();
    expect(authorized.data!.discovery_stage).toBe("contact_authorized");

    const { data: qualified } = await fx.service.from("pipeline_stages").select("id").eq("tenant_id", orgA.id).eq("is_qualified", true).eq("is_won", false).order("position").limit(1).single();
    const moved = await salesA.client.from("leads").update({ stage_id: qualified!.id }).eq("id", lead!.id).select("discovery_stage").single();
    expect(moved.data!.discovery_stage).toBe("qualified_opportunity");

    await salesA.client.from("consent_records").insert({ tenant_id: orgA.id, contact_id: contact!.id, channel: "whatsapp", purpose: "sales_followup", legal_basis: "consent", status: "revoked", source: "Pediu para sair" });
    const revoked = await fx.service.from("leads").select("discovery_stage").eq("id", lead!.id).single();
    expect(revoked.data!.discovery_stage).toBe("contact_found");
  });
});

describe("enriquecimento por CNPJ", () => {
  const DATA = { name: "PADARIA TESTE LTDA", trade_name: "Padaria Teste", cnae: "1091102", city: "Sao Paulo", state: "SP", registration_status: "Ativa", size: "MICRO EMPRESA", opened_on: "2015-03-02" };

  it("preenche só campos vazios, com proveniência, sem criar contato nem consentimento", async () => {
    const { data: company } = await salesA.client.from("companies").insert({ tenant_id: orgA.id, name: "Padaria (manual)", city: "Campinas" }).select("id").single();
    const { count: contactsBefore } = await fx.service.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", orgA.id);
    const { count: consentsBefore } = await fx.service.from("consent_records").select("id", { count: "exact", head: true }).eq("tenant_id", orgA.id);

    const { data, error } = await fx.service.rpc("company_apply_enrichment", { p_actor: salesA.id, p_tenant: orgA.id, p_company: company!.id, p_document: "11222333000181", p_status: "success", p_data: DATA });
    expect(error).toBeNull();
    expect(data!.applied_fields.sort()).toEqual(["cnae", "document", "opened_on", "registration_status", "size", "state", "trade_name"]);

    const { data: after } = await fx.service.from("companies").select("*").eq("id", company!.id).single();
    expect(after).toMatchObject({ name: "Padaria (manual)", city: "Campinas", document: "11222333000181", cnae: "1091102", trade_name: "Padaria Teste", opened_on: "2015-03-02" });
    const provenance = after!.provenance as Record<string, { source: string; enrichment_id: string; at: string }>;
    expect(provenance.cnae).toMatchObject({ source: "brasilapi_cnpj", enrichment_id: data!.id });
    expect(provenance.city).toBeUndefined();
    expect(after!.enriched_at).not.toBeNull();

    const { count: contactsAfter } = await fx.service.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", orgA.id);
    const { count: consentsAfter } = await fx.service.from("consent_records").select("id", { count: "exact", head: true }).eq("tenant_id", orgA.id);
    expect(contactsAfter).toBe(contactsBefore);
    expect(consentsAfter).toBe(consentsBefore);

    const { data: history } = await salesA.client.from("company_enrichments").select("fetched_by, status").eq("company_id", company!.id);
    expect(history).toEqual([{ fetched_by: salesA.id, status: "success" }]);

    const mismatch = await fx.service.rpc("company_apply_enrichment", { p_actor: salesA.id, p_tenant: orgA.id, p_company: company!.id, p_document: "11444777000161", p_status: "success", p_data: DATA });
    expect(mismatch.error?.message).toMatch(/document_mismatch/);
  });

  it("falha registrada sem alterar a empresa; leitor e outra empresa não enriquecem", async () => {
    const { data: company } = await salesA.client.from("companies").insert({ tenant_id: orgA.id, name: "Sem dados" }).select("id").single();
    const failed = await fx.service.rpc("company_apply_enrichment", { p_actor: salesA.id, p_tenant: orgA.id, p_company: company!.id, p_document: "11444777000161", p_status: "not_found", p_data: {} });
    expect(failed.data!.applied_fields).toEqual([]);
    const { data: unchanged } = await fx.service.from("companies").select("document, enriched_at").eq("id", company!.id).single();
    expect(unchanged).toEqual({ document: null, enriched_at: null });

    const viewer = await fx.service.rpc("company_apply_enrichment", { p_actor: viewerA.id, p_tenant: orgA.id, p_company: company!.id, p_document: "11444777000161", p_status: "success", p_data: DATA });
    expect(viewer.error?.message).toMatch(/not_authorized/);
    const other = await fx.service.rpc("company_apply_enrichment", { p_actor: ownerB.id, p_tenant: orgA.id, p_company: company!.id, p_document: "11444777000161", p_status: "success", p_data: DATA });
    expect(other.error?.message).toMatch(/not_authorized/);
    const crossTenant = await fx.service.rpc("company_apply_enrichment", { p_actor: ownerB.id, p_tenant: orgB.id, p_company: company!.id, p_document: "11444777000161", p_status: "success", p_data: DATA });
    expect(crossTenant.error?.message).toMatch(/company_not_found/);
  });

  it("toda empresa tem a origem 'Prospecção (dados públicos)'", async () => {
    const { data } = await fx.service.from("lead_sources").select("kind").eq("tenant_id", orgB.id).eq("kind", "research");
    expect(data).toHaveLength(1);
  });
});
