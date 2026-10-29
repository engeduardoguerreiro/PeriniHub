import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFixtures, type Db } from "../testing/fixtures";

// Regressão de segurança: funções restritas ao servidor não podem ser
// executadas por anônimo nem por usuário logado (Postgres concede EXECUTE a
// PUBLIC por padrão; ver migration 20261030120200). Toda função nova que só o
// servidor deve chamar entra nesta lista.

const fx = createFixtures("priv");
const ZERO = "00000000-0000-0000-0000-000000000000";
const now = new Date().toISOString();

const SERVER_ONLY: Record<string, Record<string, unknown>> = {
  whatsapp_get_access_token: { p_account: ZERO },
  whatsapp_record_inbound: { p_phone_number_id: "1", p_from_e164: "+5511999999999", p_profile_name: "", p_wa_message_id: "x", p_type: "text", p_body: "", p_media: null, p_occurred_at: now },
  whatsapp_apply_status: { p_wa_message_id: "x", p_status: "sent", p_occurred_at: now, p_pricing: null, p_errors: null },
  platform_create_organization: { p_actor: ZERO, p_name: "x", p_slug: "xxx", p_owner_email: "a@b.c", p_owner_token_hash: "0".repeat(64) },
  platform_set_organization_status: { p_actor: ZERO, p_tenant: ZERO, p_status: "active", p_reason: "xxx" },
  platform_invite_owner: { p_actor: ZERO, p_tenant: ZERO, p_email: "a@b.c", p_token_hash: "0".repeat(64) },
  effective_limit: { p_tenant: ZERO, p_metric: "x" },
  reserve_usage: { p_tenant: ZERO, p_metric: "x", p_amount: 1, p_key: "x" },
  settle_usage: { p_tenant: ZERO, p_reservation: ZERO, p_actual: 1 },
  release_usage: { p_tenant: ZERO, p_reservation: ZERO },
  consume_rate_limit: { p_key: "x:y", p_window_seconds: 60, p_max: 1 },
  whatsapp_set_connection_state: { p_phone_number_id: "evolution-xxxx", p_status: "active" },
  campaign_claim_recipients: { p_campaign: ZERO, p_limit: 1 },
  capture_form_submit: { p_public_key: "0".repeat(32), p_full_name: "x", p_phone_e164: null, p_email: "a@b.c", p_company: null, p_job_title: null, p_message: null, p_consent: true, p_consent_version: 1, p_payload_hash: "0".repeat(64), p_ip_hash: null, p_user_agent: null },
};

const SIGNED_IN_ONLY: Record<string, Record<string, unknown>> = {
  create_invite: { p_tenant: ZERO, p_email: "a@b.c", p_role: "viewer", p_token_hash: "0".repeat(64) },
  whatsapp_send_gate: { p_tenant: ZERO, p_contact: ZERO, p_phone_number: ZERO, p_kind: "free_text", p_origin: "user", p_idempotency_key: "xxxxxxxxxx" },
  whatsapp_set_access_token: { p_tenant: ZERO, p_account: ZERO, p_token: "x".repeat(30) },
  record_export: { p_tenant: ZERO, p_entity: "x", p_rows: 1, p_filters: {} },
  campaign_build_audience: { p_tenant: ZERO, p_campaign: ZERO },
  campaign_transition: { p_tenant: ZERO, p_campaign: ZERO, p_to: "canceled", p_reason: "xxx" },
  company_apply_enrichment: { p_tenant: ZERO, p_company: ZERO, p_document: "11222333000181", p_status: "success", p_data: {} },
  create_agent_version: { p_tenant: ZERO, p_agent: ZERO, p_system_prompt: "x".repeat(30), p_provider: "mock", p_model: "mock", p_max_output_tokens: 500, p_input_price: 0, p_output_price: 0, p_knowledge_base_ids: [] },
};

let signedIn: Db;

beforeAll(async () => {
  signedIn = (await fx.createUser("logado")).client;
});
afterAll(() => fx.cleanup());

describe("privilégios de funções", () => {
  it.each(Object.entries(SERVER_ONLY))("%s: só o servidor executa", async (name, args) => {
    for (const client of [fx.anon, signedIn]) {
      const { error } = await client.rpc(name as never, args as never);
      expect(error?.code, `${name} executou sem permissão`).toBe("42501");
      expect(error?.message).toMatch(/permission denied/);
    }
  });

  it.each(Object.entries(SIGNED_IN_ONLY))("%s: anônimo não executa", async (name, args) => {
    const { error } = await fx.anon.rpc(name as never, args as never);
    expect(error?.code).toBe("42501");
  });

  it("helpers do schema private não são chamáveis pela API", async () => {
    const { error } = await fx.anon.schema("private" as never).rpc("seed_crm_defaults" as never, { p_tenant: ZERO } as never);
    expect(error).not.toBeNull();
  });
});
