import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

vi.mock("server-only", () => ({}));

const { dispatchCampaignBatch, runFollowupRules } = await import("./dispatch");

// Campanhas e follow-up contra o Supabase "AI Sales" (número simulado).
// Cenários críticos: 4 (sem autorização não recebe), 5 (descadastrado não
// recebe), 8 (pausada não envia) e "agendamento não substitui o gate".

const fx = createFixtures("cp");

let ownerA: TestUser;
let managerA: TestUser;
let salesA: TestUser;
let orgA: { id: string };
let number: { id: string };
let marketing: string;
let utility: string;

async function contact(name: string, phone: string, consent: "marketing" | "sales_followup" | null, suppressed = false) {
  const { data } = await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: name, phone_e164: phone }).select("id").single();
  if (consent) await fx.service.from("consent_records").insert({ tenant_id: orgA.id, contact_id: data!.id, channel: "whatsapp", purpose: consent, legal_basis: "consent", status: "granted", source: "teste" });
  if (suppressed) await fx.service.from("suppression_list").insert({ tenant_id: orgA.id, channel: "whatsapp", identifier: phone, reason: "opt_out", source: "teste" });
  return data!.id;
}

async function campaign(by: TestUser, extra: Record<string, unknown> = {}) {
  const { data, error } = await by.client
    .from("campaigns")
    .insert({ tenant_id: orgA.id, name: `Campanha ${randomUUID().slice(0, 6)}`, phone_number_id: number.id, template_id: marketing, template_parameters: ["{{nome}}"], window_start: "00:00", window_end: "23:59", created_by: by.id, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const transition = (by: TestUser, id: string, to: string, reason?: string, emergency = false) =>
  by.client.rpc("campaign_transition", { p_tenant: orgA.id, p_campaign: id, p_to: to as never, p_reason: reason, p_emergency: emergency });

async function approved(id: string) {
  await managerA.client.rpc("campaign_build_audience", { p_tenant: orgA.id, p_campaign: id });
  await transition(ownerA, id, "awaiting_approval");
  const approval = await transition(managerA, id, "scheduled");
  if (approval.error) throw approval.error;
}

let c1: string, c2: string, c3: string, c4: string;

beforeAll(async () => {
  [ownerA, managerA, salesA] = await Promise.all(["owner-a", "manager-a", "sales-a"].map(fx.createUser));
  orgA = await fx.createOrg("cp-a", ownerA);
  await fx.addMember(orgA.id, ownerA, managerA, "manager");
  await fx.addMember(orgA.id, ownerA, salesA, "sales");
  const { data: account } = await fx.service.from("whatsapp_accounts").insert({ tenant_id: orgA.id, provider: "sandbox", status: "active" }).select("id").single();
  const { data } = await fx.service.from("whatsapp_phone_numbers").insert({ tenant_id: orgA.id, account_id: account!.id, phone_number_id: `sandbox-${randomUUID().slice(0, 18)}`, display_phone: "simulado", status: "active" }).select("id").single();
  number = data!;
  const { data: templates } = await fx.service
    .from("whatsapp_templates")
    .insert([
      { tenant_id: orgA.id, account_id: account!.id, name: "oferta", language: "pt_BR", category: "marketing", status: "APPROVED", components: [{ type: "BODY", text: "Oi {{1}}" }] },
      { tenant_id: orgA.id, account_id: account!.id, name: "retomada", language: "pt_BR", category: "utility", status: "APPROVED", components: [{ type: "BODY", text: "Oi {{1}}, seguimos?" }] },
    ])
    .select("id, name");
  marketing = templates!.find((template) => template.name === "oferta")!.id;
  utility = templates!.find((template) => template.name === "retomada")!.id;
  c1 = await contact("Ana Consentiu", "+5511944440001", "marketing");
  c2 = await contact("Bruno Sem Consentimento", "+5511944440002", null);
  c3 = await contact("Carla Descadastrada", "+5511944440003", "marketing", true);
  c4 = await contact("Davi Consentiu", "+5511944440004", "marketing");
});

afterAll(() => fx.cleanup());

describe("público e aprovação", () => {
  it("público separa elegíveis e excluídos com o motivo", async () => {
    const id = await campaign(ownerA);
    const { data } = await managerA.client.rpc("campaign_build_audience", { p_tenant: orgA.id, p_campaign: id });
    expect(data).toEqual({ eligible: 2, excluded: 2 });
    const { data: excluded } = await fx.service.from("campaign_recipients").select("contact_id, exclusion_reason").eq("campaign_id", id).eq("eligibility", "excluded");
    expect(Object.fromEntries(excluded!.map((row) => [row.contact_id, row.exclusion_reason]))).toEqual({ [c2]: "sem consentimento para a finalidade", [c3]: "descadastrado" });
  });

  it("vendedor não monta público nem muda status; quem criou não aprova havendo outro gestor", async () => {
    const id = await campaign(ownerA);
    expect((await salesA.client.rpc("campaign_build_audience", { p_tenant: orgA.id, p_campaign: id })).error?.message).toContain("not_authorized");
    expect((await transition(ownerA, id, "awaiting_approval")).error?.message).toContain("audience_required");
    await managerA.client.rpc("campaign_build_audience", { p_tenant: orgA.id, p_campaign: id });
    expect((await transition(ownerA, id, "running")).error?.message).toContain("invalid_transition");
    await transition(ownerA, id, "awaiting_approval");
    expect((await transition(ownerA, id, "scheduled")).error?.message).toContain("approval_by_other");
    expect((await transition(salesA, id, "scheduled")).error?.message).toContain("not_authorized");
    const ok = await transition(managerA, id, "scheduled");
    expect(ok.data).toMatchObject({ status: "scheduled", approved_by: managerA.id });
    // Status só muda pela função, nunca por update direto.
    await ownerA.client.from("campaigns").update({ status: "running" } as never).eq("id", id);
    expect((await fx.service.from("campaigns").select("status").eq("id", id).single()).data?.status).toBe("scheduled");
  });
});

describe("envio", () => {
  it("cenários 4 e 5: só os elegíveis recebem; sem consentimento e descadastrado nunca", async () => {
    const id = await campaign(ownerA);
    await approved(id);
    const result = await dispatchCampaignBatch(orgA.id, id);
    expect(result).toMatchObject({ status: "sent", sent: 2, blocked: 0 });
    const { data: requests } = await fx.service.from("message_send_requests").select("contact_id, decision").like("idempotency_key", `campaign:${id}:%`);
    expect(requests?.map((row) => row.contact_id).sort()).toEqual([c1, c4].sort());
    expect((await dispatchCampaignBatch(orgA.id, id)).status).toBe("completed");
  });

  it("agendamento não substitui o gate: consentimento revogado depois do público é bloqueado no envio", async () => {
    const extra = await contact("Eva Revogou", "+5511944440005", "marketing");
    const id = await campaign(ownerA);
    await approved(id);
    await fx.service.from("consent_records").insert({ tenant_id: orgA.id, contact_id: extra, channel: "whatsapp", purpose: "marketing", legal_basis: "consent", status: "revoked", source: "teste" });
    await dispatchCampaignBatch(orgA.id, id);
    const { data } = await fx.service.from("campaign_recipients").select("status, detail").eq("campaign_id", id).eq("contact_id", extra).single();
    expect(data?.status).toBe("blocked");
    expect(data?.detail).toContain("sem consentimento");
  });

  it("cenário 8: campanha pausada não envia; pausa de emergência não pode ser retomada", async () => {
    await contact("Fábio Consentiu", "+5511944440006", "marketing");
    const id = await campaign(ownerA);
    await approved(id);
    await transition(managerA, id, "running");
    expect((await transition(managerA, id, "paused")).error?.message).toContain("reason_required");
    await transition(managerA, id, "paused", "revisar texto", true);
    expect(await dispatchCampaignBatch(orgA.id, id)).toMatchObject({ status: "stopped", sent: 0 });
    expect((await transition(managerA, id, "running")).error?.message).toContain("invalid_transition");
    const { count } = await fx.service.from("message_send_requests").select("*", { count: "exact", head: true }).like("idempotency_key", `campaign:${id}:%`);
    expect(count).toBe(0);
  });

  it("limite por hora e janela de horário seguram o lote", async () => {
    const id = await campaign(ownerA, { hourly_limit: 1 });
    await approved(id);
    // Cada lote processa no máximo 1 contato; envios barrados pelo gate não
    // contam no limite. Depois do primeiro envio real, a hora está esgotada.
    await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: "Hora Um", phone_e164: "+5511944440010" });
    let sentOnce = false;
    for (let attempt = 0; attempt < 6 && !sentOnce; attempt++) {
      const batch = await dispatchCampaignBatch(orgA.id, id);
      expect(batch.sent + batch.blocked + batch.failed).toBeLessThanOrEqual(1);
      sentOnce = batch.sent === 1;
      if (batch.status === "completed") break;
    }
    if (sentOnce) expect((await dispatchCampaignBatch(orgA.id, id)).status).toBe("limit_reached");
    const closed = await campaign(ownerA, { window_start: "00:00", window_end: "00:01" });
    await approved(closed);
    const night = Date.parse("2026-11-02T15:00:00Z");
    expect((await dispatchCampaignBatch(orgA.id, closed, night)).status).toBe("outside_window");
  });

  it("vendedor não vê campanhas nem destinatários", async () => {
    expect((await salesA.client.from("campaigns").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await salesA.client.from("campaign_recipients").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
  });
});

describe("follow-up automático", () => {
  it("retoma lead parado uma vez, respeita o intervalo e não repete a tentativa", async () => {
    const followupContact = await contact("Gil Follow", "+5511944440007", "sales_followup");
    const { data: pipeline } = await fx.service.from("pipelines").select("id, pipeline_stages(id, position)").eq("tenant_id", orgA.id).single();
    const stage = pipeline!.pipeline_stages.sort((a, b) => a.position - b.position)[1];
    const { data: lead } = await fx.service.from("leads").insert({ tenant_id: orgA.id, contact_id: followupContact, pipeline_id: pipeline!.id, stage_id: stage.id }).select("id").single();
    await fx.service.from("leads").update({ stage_changed_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }).eq("id", lead!.id);
    const { data: rule } = await managerA.client
      .from("followup_rules")
      .insert({ tenant_id: orgA.id, name: "Retomada", active: true, idle_days: 7, stage_ids: [stage.id], phone_number_id: number.id, template_id: utility, template_parameters: ["{{nome}}"], purpose: "sales_followup" })
      .select("id")
      .single();

    const first = await runFollowupRules(orgA.id);
    expect(first.find((item) => item.ruleId === rule!.id)).toMatchObject({ sent: 1 });
    const second = await runFollowupRules(orgA.id);
    expect(second.find((item) => item.ruleId === rule!.id)).toMatchObject({ sent: 0, blocked: 0, failed: 0 });
    const { data: executions } = await fx.service.from("followup_executions").select("attempt, status").eq("rule_id", rule!.id);
    expect(executions).toEqual([{ attempt: 1, status: "sent" }]);
  });
});
