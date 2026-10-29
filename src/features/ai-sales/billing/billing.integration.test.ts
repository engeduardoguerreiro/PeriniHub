import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

// Fase 7 contra o Supabase "AI Sales" (dev). Aceite: limites de plano
// aplicados no banco; ações de plataforma auditadas com motivo; preço só é
// definitivo quando marcado.

const fx = createFixtures("bil");

let owner: TestUser;
let admin: TestUser;
let sales: TestUser;
let outsider: TestUser;
let platform: TestUser;
let org: { id: string };
let stage: { id: string; pipeline_id: string };

const subscription = (overrides: Record<string, number>, status = "internal", reason: string | null = "teste de limite") =>
  fx.service.rpc("platform_update_subscription", {
    p_actor: platform.id,
    p_tenant: org.id,
    p_plan_code: "internal",
    p_status: status,
    p_period_start: null,
    p_period_end: null,
    p_limit_overrides: overrides,
    p_notes: null,
    p_reason: reason,
  } as never);

async function company() {
  const { data } = await sales.client.from("companies").insert({ tenant_id: org.id, name: `Empresa ${Math.random().toString(36).slice(2, 8)}` }).select("id").single();
  return data!.id;
}

beforeAll(async () => {
  [owner, admin, sales, outsider] = await Promise.all(["owner", "admin", "sales", "outsider"].map(fx.createUser));
  org = await fx.createOrg("bil", owner);
  await fx.addMember(org.id, owner, admin, "admin");
  await fx.addMember(org.id, owner, sales, "sales");
  platform = await fx.platform();
  const { data } = await fx.service.from("pipeline_stages").select("id, pipeline_id").eq("tenant_id", org.id).order("position").limit(1).single();
  stage = data!;
});
afterAll(async () => {
  await fx.service.from("subscription_plans").delete().like("code", `zz_${fx.tag.replace(/-/g, "_")}%`);
  await fx.cleanup();
});

describe("limites aplicados no banco", () => {
  it("leads: o próximo além do limite é recusado, mesmo pela secret key", async () => {
    const id = await company();
    expect((await subscription({ leads: 1 })).error).toBeNull();
    const first = await sales.client.from("leads").insert({ tenant_id: org.id, company_id: id, pipeline_id: stage.pipeline_id, stage_id: stage.id });
    expect(first.error).toBeNull();
    const second = await sales.client.from("leads").insert({ tenant_id: org.id, company_id: id, pipeline_id: stage.pipeline_id, stage_id: stage.id });
    expect(second.error?.message).toMatch(/plan_limit_reached: leads/);
    const service = await fx.service.from("leads").insert({ tenant_id: org.id, company_id: id, pipeline_id: stage.pipeline_id, stage_id: stage.id });
    expect(service.error?.message).toMatch(/plan_limit_reached/);

    const { data: usage } = await sales.client.rpc("organization_usage", { p_tenant: org.id });
    expect(usage!.find((row) => row.metric === "leads")).toMatchObject({ kind: "count", used: 1, limit_value: 1 });
    await subscription({});
  });

  it("membros: convite pendente ocupa vaga", async () => {
    expect((await subscription({ members: 4 })).error).toBeNull();
    const first = await owner.client.rpc("create_invite", { p_tenant: org.id, p_email: `zz-a-${fx.tag}@teste.perinihub.local`, p_role: "viewer", p_token_hash: "a".repeat(64) });
    expect(first.error).toBeNull();
    const second = await owner.client.rpc("create_invite", { p_tenant: org.id, p_email: `zz-b-${fx.tag}@teste.perinihub.local`, p_role: "viewer", p_token_hash: "b".repeat(64) });
    expect(second.error?.message).toMatch(/plan_limit_reached: members/);
    await subscription({});
  });

  it("formulários: limite por contagem", async () => {
    expect((await subscription({ capture_forms: 0 })).error).toBeNull();
    const blocked = await owner.client.from("capture_forms").insert({ tenant_id: org.id, name: "F", headline: "F", consent_text: "Autorizo o contato pelo WhatsApp para este pedido." });
    expect(blocked.error?.message).toMatch(/plan_limit_reached: capture_forms/);
    await subscription({});
  });

  it("assinatura em atraso bloqueia criação; voltar a ativa libera", async () => {
    const id = await company();
    expect((await subscription({}, "past_due")).error).toBeNull();
    const blocked = await sales.client.from("leads").insert({ tenant_id: org.id, company_id: id, pipeline_id: stage.pipeline_id, stage_id: stage.id });
    expect(blocked.error?.message).toMatch(/plan_limit_not_configured/);
    await subscription({}, "active");
    const ok = await sales.client.from("leads").insert({ tenant_id: org.id, company_id: id, pipeline_id: stage.pipeline_id, stage_id: stage.id });
    expect(ok.error).toBeNull();
    await subscription({});
  });

  it("consumo só para membros", async () => {
    const denied = await outsider.client.rpc("organization_usage", { p_tenant: org.id });
    expect(denied.error?.message).toMatch(/not_authorized/);
  });
});

describe("ações de plataforma", () => {
  it("exigem superadmin e motivo; o motivo vai para a auditoria", async () => {
    expect((await subscription({}, "internal", null)).error?.message).toMatch(/reason_required/);
    const notAdmin = await fx.service.rpc("platform_update_subscription", {
      p_actor: owner.id, p_tenant: org.id, p_plan_code: "internal", p_status: "internal", p_period_start: null, p_period_end: null, p_limit_overrides: {}, p_notes: null, p_reason: "tentativa",
    } as never);
    expect(notAdmin.error?.message).toMatch(/not_platform_admin/);

    await subscription({ leads: 777 }, "internal", "ajuste negociado com o cliente");
    const { data: log } = await fx.service
      .from("audit_logs")
      .select("actor_type, actor_id, reason")
      .eq("tenant_id", org.id)
      .eq("entity_type", "subscriptions")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(log).toEqual({ actor_type: "platform_admin", actor_id: platform.id, reason: "ajuste negociado com o cliente" });
    await subscription({});
  });

  it("planos: métrica desconhecida recusada; preço definitivo exige valor", async () => {
    const code = `zz_${fx.tag.replace(/-/g, "_")}`;
    const upsert = (limits: Record<string, number>, price: number | null, final: boolean) =>
      fx.service.rpc("platform_upsert_plan", {
        p_actor: platform.id, p_code: code, p_name: "Plano teste", p_description: "", p_limits: limits, p_price_monthly_cents: price, p_price_is_final: final, p_is_public: false, p_active: true, p_reason: "teste",
      } as never);
    expect((await upsert({ inventado: 1 }, null, false)).error?.message).toMatch(/invalid_limits/);
    expect((await upsert({ leads: 10 }, null, true)).error?.message).toMatch(/subscription_plans_final_price/);
    expect((await upsert({ leads: 10 }, 19900, false)).error).toBeNull();
    const { data } = await fx.service.from("subscription_plans").select("price_monthly_cents, price_is_final, entitlements").eq("code", code).single();
    expect(data).toMatchObject({ price_monthly_cents: 19900, price_is_final: false, entitlements: { limits: { leads: 10 } } });
  });

  it("cobrança manual: rascunho invisível, emitida só para admin, transições válidas", async () => {
    const { data: id, error } = await fx.service.rpc("platform_create_invoice", {
      p_actor: platform.id, p_tenant: org.id, p_description: "Mensalidade teste", p_amount_cents: 19990, p_due_date: "2026-12-10", p_period_start: null, p_period_end: null, p_notes: null, p_reason: "primeira cobrança",
    } as never);
    expect(error).toBeNull();
    const invoice = id as unknown as string;
    expect((await admin.client.from("billing_invoices").select("id").eq("id", invoice)).data).toHaveLength(0);

    const set = (status: string, method: string | null = null) =>
      fx.service.rpc("platform_set_invoice_status", { p_actor: platform.id, p_invoice: invoice, p_status: status, p_payment_method: method, p_external_ref: null, p_reason: "teste" } as never);
    expect((await set("paid", "PIX")).error?.message).toMatch(/invalid_transition/);
    expect((await set("issued")).error).toBeNull();
    expect((await admin.client.from("billing_invoices").select("number, status").eq("id", invoice).single()).data).toMatchObject({ status: "issued", number: expect.stringMatching(/^PH-\d{4}-\d{5}$/) });
    expect((await sales.client.from("billing_invoices").select("id").eq("id", invoice)).data).toHaveLength(0);
    expect((await outsider.client.from("billing_invoices").select("id").eq("id", invoice)).data).toHaveLength(0);
    expect((await set("paid")).error?.message).toMatch(/payment_method_required/);
    expect((await set("paid", "PIX")).error).toBeNull();
    expect((await set("canceled")).error?.message).toMatch(/invalid_transition/);
    const updated = await admin.client.from("billing_invoices").update({ status: "canceled" } as never).eq("id", invoice).select("id");
    expect(updated.data ?? []).toHaveLength(0);
  });

  it("saúde das integrações: só o servidor", async () => {
    const { data, error } = await fx.service.rpc("platform_integration_health");
    expect(error).toBeNull();
    expect(data!.some((row) => row.tenant_id === org.id)).toBe(true);
  });
});
