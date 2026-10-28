import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

// send.ts é server-only; fora do Next o pacote lança, então é neutralizado aqui.
vi.mock("server-only", () => ({}));

const { ingestEvents, ingestPayload, processEvents } = await import("./processor");
const { sendWhatsApp } = await import("./send");

// WhatsApp contra o Supabase "AI Sales", em modo simulado (nada sai para a
// Meta). Cobre os cenários críticos 3 (webhook duplicado), 4 (sem
// autorização), 5 (descadastro), 6 (fora da janela) e 7 (segredo).

const fx = createFixtures("wa");

let ownerA: TestUser;
let salesA: TestUser;
let viewerA: TestUser;
let ownerB: TestUser;
let orgA: { id: string };
let orgB: { id: string };
let numberA: { id: string; phone_number_id: string; account_id: string };
let numberB: { id: string; phone_number_id: string };

async function sandboxNumber(tenant: string) {
  const { data: account } = await fx.service.from("whatsapp_accounts").insert({ tenant_id: tenant, provider: "sandbox", status: "active" }).select("id").single();
  const phone = `sandbox-${randomUUID().slice(0, 18)}`;
  const { data } = await fx.service
    .from("whatsapp_phone_numbers")
    .insert({ tenant_id: tenant, account_id: account!.id, phone_number_id: phone, display_phone: "simulado", status: "active" })
    .select("id, phone_number_id, account_id")
    .single();
  await fx.service.from("whatsapp_templates").insert([
    { tenant_id: tenant, account_id: account!.id, name: "oferta_teste", language: "pt_BR", category: "marketing", status: "APPROVED", components: [{ type: "BODY", text: "Oferta {{1}}" }] },
    { tenant_id: tenant, account_id: account!.id, name: "rascunho_teste", language: "pt_BR", category: "utility", status: "PENDING", components: [] },
  ]);
  return data!;
}

function inbound(phoneNumberId: string, from: string, body: string, id = `wamid.${randomUUID()}`, timestamp = Math.floor(Date.now() / 1000)) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneNumberId }, contacts: [{ wa_id: from, profile: { name: "Cliente Teste" } }], messages: [{ from, id, timestamp: String(timestamp), type: "text", text: { body } }] } }] }],
  };
}

async function receive(phoneNumberId: string, from: string, body: string, id?: string, timestamp?: number) {
  const { queued } = await ingestPayload(inbound(phoneNumberId, from, body, id, timestamp));
  await processEvents(queued);
  return queued;
}

async function contactByPhone(tenant: string, phone: string) {
  const { data } = await fx.service.from("contacts").select("id").eq("tenant_id", tenant).eq("phone_e164", phone).single();
  return data!.id;
}

async function templateId(tenant: string, name: string) {
  const { data } = await fx.service.from("whatsapp_templates").select("id").eq("tenant_id", tenant).eq("name", name).single();
  return data!.id;
}

beforeAll(async () => {
  [ownerA, salesA, viewerA, ownerB] = await Promise.all(["owner-a", "sales-a", "viewer-a", "owner-b"].map(fx.createUser));
  orgA = await fx.createOrg("wa-a", ownerA);
  orgB = await fx.createOrg("wa-b", ownerB);
  await fx.addMember(orgA.id, ownerA, salesA, "sales");
  await fx.addMember(orgA.id, ownerA, viewerA, "viewer");
  numberA = await sandboxNumber(orgA.id);
  numberB = await sandboxNumber(orgB.id);
});

afterAll(async () => {
  await fx.service.from("webhook_events").delete().in("phone_number_id", [numberA.phone_number_id, numberB.phone_number_id, "999999999"]);
  await fx.cleanup();
});

describe("recebimento (webhook)", () => {
  it("cenário 3: o mesmo evento entregue duas vezes cria uma única mensagem", async () => {
    const id = `wamid.${randomUUID()}`;
    await receive(numberA.phone_number_id, "5511911110001", "Oi, quero orçamento", id);
    const second = await receive(numberA.phone_number_id, "5511911110001", "Oi, quero orçamento", id);
    expect(second).toEqual([]);
    const { count } = await fx.service.from("messages").select("*", { count: "exact", head: true }).eq("wa_message_id", id);
    expect(count).toBe(1);
  });

  it("contato novo vira contato + lead (origem WhatsApp) + conversa com janela aberta", async () => {
    await receive(numberA.phone_number_id, "5511911110002", "Bom dia");
    const contactId = await contactByPhone(orgA.id, "+5511911110002");
    const { data: lead } = await fx.service.from("leads").select("lead_sources(kind)").eq("contact_id", contactId).single();
    expect(lead?.lead_sources?.kind).toBe("whatsapp_inbound");
    const { data: conversation } = await fx.service.from("conversations").select("last_inbound_at, unread_count").eq("contact_id", contactId).single();
    expect(conversation?.unread_count).toBe(1);
    expect(conversation?.last_inbound_at).not.toBeNull();
  });

  it("número desconhecido é ignorado sem criar nada", async () => {
    const { queued } = await ingestPayload(inbound("999999999", "5511911110003", "x"));
    expect(queued).toEqual([]);
    expect((await fx.service.from("contacts").select("id").eq("phone_e164", "+5511911110003")).data).toEqual([]);
  });

  it("isolamento: mensagens da A não aparecem para a B; viewer não lê conversas", async () => {
    expect((await ownerB.client.from("conversations").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await ownerB.client.from("messages").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await viewerA.client.from("messages").select("id").eq("tenant_id", orgA.id)).data).toEqual([]);
    expect((await salesA.client.from("messages").select("id").eq("tenant_id", orgA.id)).data?.length).toBeGreaterThan(0);
  });
});

describe("gate de envio", () => {
  it("cenário 6: dentro da janela a resposta livre passa; fora dela é bloqueada com o motivo", async () => {
    await receive(numberA.phone_number_id, "5511911110004", "Pode me ligar?");
    const contactId = await contactByPhone(orgA.id, "+5511911110004");
    const ok = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user", kind: "free_text", body: "Claro!" });
    expect(ok.ok).toBe(true);

    await fx.service.from("conversations").update({ last_inbound_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() }).eq("contact_id", contactId);
    const blocked = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user", kind: "free_text", body: "Oi de novo" });
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.ok === false && blocked.blocked).toContain("fora da janela de 24 h (use um template aprovado)");
    const { data } = await fx.service.from("message_send_requests").select("decision, checks").eq("contact_id", contactId).eq("decision", "blocked").single();
    expect(data?.checks).toMatchObject({ service_window: { ok: false } });
  });

  it("cenário 4: template de marketing sem consentimento é bloqueado; com consentimento passa", async () => {
    const { data: contact } = await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: "Sem conversa", phone_e164: "+5511911110005" }).select("id").single();
    const offer = await templateId(orgA.id, "oferta_teste");
    const noConsent = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId: contact!.id, phoneNumberId: numberA.id, origin: "user", kind: "template", templateId: offer, parameters: ["10%"] });
    expect(noConsent.ok === false && noConsent.blocked).toContain("sem consentimento vigente para essa finalidade");

    await salesA.client.from("consent_records").insert({ tenant_id: orgA.id, contact_id: contact!.id, channel: "whatsapp", purpose: "marketing", legal_basis: "consent", status: "granted", source: "teste" });
    const withConsent = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId: contact!.id, phoneNumberId: numberA.id, origin: "user", kind: "template", templateId: offer, parameters: ["10%"] });
    expect(withConsent.ok).toBe(true);

    const pending = await templateId(orgA.id, "rascunho_teste");
    const notApproved = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId: contact!.id, phoneNumberId: numberA.id, origin: "user", kind: "template", templateId: pending, parameters: [] });
    expect(notApproved.ok === false && notApproved.blocked).toContain("template não aprovado");
  });

  it("cenário 5: 'SAIR' descadastra, cancela pendentes e bloqueia novos envios", async () => {
    await receive(numberA.phone_number_id, "5511911110006", "Olá");
    const contactId = await contactByPhone(orgA.id, "+5511911110006");
    await salesA.client.from("consent_records").insert({ tenant_id: orgA.id, contact_id: contactId, channel: "whatsapp", purpose: "marketing", legal_basis: "consent", status: "granted", source: "teste" });
    await receive(numberA.phone_number_id, "5511911110006", "SAIR");

    const { data: suppression } = await fx.service.from("suppression_list").select("reason").eq("tenant_id", orgA.id).eq("identifier", "+5511911110006").single();
    expect(suppression?.reason).toBe("opt_out");
    const { data: consent } = await fx.service.from("current_consents").select("is_valid").eq("contact_id", contactId).eq("purpose", "marketing").single();
    expect(consent?.is_valid).toBe(false);
    const template = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "campaign", kind: "template", templateId: await templateId(orgA.id, "oferta_teste"), parameters: ["x"] });
    expect(template.ok === false && template.blocked).toContain("contato descadastrado");
    const free = await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user", kind: "free_text", body: "Tudo bem?" });
    expect(free.ok === false && free.blocked).toContain("contato descadastrado");
    const { data: note } = await fx.service.from("messages").select("sender_type").eq("tenant_id", orgA.id).eq("sender_type", "system").limit(1);
    expect(note).toHaveLength(1);
  });

  it("mesma chave de idempotência nunca envia duas vezes", async () => {
    await receive(numberA.phone_number_id, "5511911110007", "Oi");
    const contactId = await contactByPhone(orgA.id, "+5511911110007");
    const input = { db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user" as const, kind: "free_text" as const, body: "Uma vez só", idempotencyKey: `user:${randomUUID()}` };
    expect((await sendWhatsApp(input)).ok).toBe(true);
    expect(await sendWhatsApp(input)).toEqual({ ok: false, reason: "Este envio já foi processado." });
    const { count } = await fx.service.from("messages").select("*", { count: "exact", head: true }).eq("body", "Uma vez só");
    expect(count).toBe(1);
  });

  it("viewer não envia; membro da B não envia para contato da A", async () => {
    const contactId = await contactByPhone(orgA.id, "+5511911110002");
    const byViewer = await sendWhatsApp({ db: viewerA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user", kind: "free_text", body: "x" });
    expect(byViewer).toMatchObject({ ok: false, reason: "Sem permissão para enviar." });
    const crossTenant = await ownerB.client.rpc("whatsapp_send_gate", { p_tenant: orgA.id, p_contact: contactId, p_phone_number: numberA.id, p_kind: "free_text", p_origin: "user", p_idempotency_key: `x-${randomUUID()}`, p_body: "x" });
    expect(crossTenant.error?.message).toContain("not_authorized");
    const wrongNumber = await ownerB.client.rpc("whatsapp_send_gate", { p_tenant: orgB.id, p_contact: contactId, p_phone_number: numberB.id, p_kind: "free_text", p_origin: "user", p_idempotency_key: `y-${randomUUID()}`, p_body: "x" });
    expect(wrongNumber.error?.message).toContain("invalid_target");
  });
});

describe("status de entrega", () => {
  it("só avança: 'entregue' depois de 'lida' não regride; repetido não duplica", async () => {
    await receive(numberA.phone_number_id, "5511911110008", "Oi");
    const contactId = await contactByPhone(orgA.id, "+5511911110008");
    await sendWhatsApp({ db: salesA.client, tenantId: orgA.id, contactId, phoneNumberId: numberA.id, origin: "user", kind: "free_text", body: "Status teste" });
    const { data: message } = await fx.service.from("messages").select("wa_message_id").eq("body", "Status teste").single();
    const statusPayload = (status: string) => ({
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "messages", value: { metadata: { phone_number_id: numberA.phone_number_id }, statuses: [{ id: message!.wa_message_id, status, timestamp: String(Math.floor(Date.now() / 1000)) }] } }] }],
    });
    for (const status of ["read", "delivered", "read"]) {
      const { queued } = await ingestPayload(statusPayload(status));
      await processEvents(queued);
    }
    const { data: after } = await fx.service.from("messages").select("status").eq("wa_message_id", message!.wa_message_id!).single();
    expect(after?.status).toBe("read");
    const { count } = await fx.service.from("message_delivery_events").select("*", { count: "exact", head: true }).eq("wa_message_id", message!.wa_message_id!);
    expect(count).toBe(2);
  });
});

describe("cenário 7: segredos", () => {
  it("token vai para o Vault; usuários não leem o token nem a referência", async () => {
    const { data: account } = await ownerA.client
      .from("whatsapp_accounts")
      .insert({ tenant_id: orgA.id, provider: "meta_cloud", waba_id: String(Date.now()).slice(-12), status: "pending" })
      .select("id")
      .single();
    const token = `EAAG${randomUUID().replace(/-/g, "")}secreto`;
    expect((await salesA.client.rpc("whatsapp_set_access_token", { p_tenant: orgA.id, p_account: account!.id, p_token: token })).error?.message).toContain("not_authorized");
    expect((await ownerA.client.rpc("whatsapp_set_access_token", { p_tenant: orgA.id, p_account: account!.id, p_token: token })).error).toBeNull();

    const { data: visible } = await ownerA.client.from("whatsapp_accounts").select("token_last4").eq("id", account!.id).single();
    expect(visible?.token_last4).toBe(token.slice(-4));
    expect((await ownerA.client.from("whatsapp_accounts").select("access_token_secret_id").eq("id", account!.id)).error).not.toBeNull();
    expect((await ownerA.client.rpc("whatsapp_get_access_token", { p_account: account!.id })).error).not.toBeNull();
    expect((await fx.service.rpc("whatsapp_get_access_token", { p_account: account!.id })).data).toBe(token);
    expect((await ownerA.client.from("webhook_events").select("id").limit(1)).data ?? []).toEqual([]);
    await fx.service.from("whatsapp_accounts").delete().eq("id", account!.id);
  });
});

describe("Evolution (não oficial): regras do gate", () => {
  let evolution: { id: string; phone_number_id: string };

  beforeAll(async () => {
    const { data: account } = await fx.service.from("whatsapp_accounts").insert({ tenant_id: orgA.id, provider: "evolution", status: "active" }).select("id").single();
    const id = randomUUID();
    const { data } = await fx.service
      .from("whatsapp_phone_numbers")
      .insert({ id, tenant_id: orgA.id, account_id: account!.id, phone_number_id: `evolution-${id}`, display_phone: "evo", status: "active" })
      .select("id, phone_number_id")
      .single();
    evolution = data!;
  });

  const gate = (contactId: string, origin: "user" | "campaign" | "agent" | "followup", kind: "free_text" | "template" = "free_text") =>
    salesA.client.rpc("whatsapp_send_gate", { p_tenant: orgA.id, p_contact: contactId, p_phone_number: evolution.id, p_kind: kind, p_origin: origin, p_idempotency_key: `evo-${randomUUID()}`, p_body: "Olá" });

  it("proativo exige envio manual e consentimento; campanha e agente nunca iniciam conversa", async () => {
    const { data: contact } = await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: "Evo 1", phone_e164: "+5511922220001" }).select("id").single();
    expect((await gate(contact!.id, "user")).data?.checks).toMatchObject({ consent: { ok: false } });
    await salesA.client.from("consent_records").insert({ tenant_id: orgA.id, contact_id: contact!.id, channel: "whatsapp", purpose: "sales_followup", legal_basis: "consent", status: "granted", source: "teste" });
    for (const origin of ["campaign", "agent", "followup"] as const) {
      const { data } = await gate(contact!.id, origin);
      expect(data).toMatchObject({ decision: "blocked", checks: { manual_only: { ok: false } } });
    }
    expect((await gate(contact!.id, "user")).data).toMatchObject({ decision: "allowed", proactive: true });
    expect((await gate(contact!.id, "user", "template")).data).toMatchObject({ decision: "blocked", checks: { provider_kind: { ok: false } } });
  });

  it("limite diário por número e no máximo 2 proativas por contato em 7 dias", async () => {
    await ownerA.client.from("organization_settings").update({ evolution_daily_proactive_limit: 3 }).eq("tenant_id", orgA.id);
    const contacts = [];
    for (const suffix of ["11", "12", "13"]) {
      const { data } = await fx.service.from("contacts").insert({ tenant_id: orgA.id, full_name: `Evo ${suffix}`, phone_e164: `+55119222200${suffix}` }).select("id").single();
      await fx.service.from("consent_records").insert({ tenant_id: orgA.id, contact_id: data!.id, channel: "whatsapp", purpose: "marketing", legal_basis: "consent", status: "granted", source: "teste" });
      contacts.push(data!.id);
    }
    // Já houve 1 proativa permitida neste número no teste anterior.
    expect((await gate(contacts[0], "user")).data?.decision).toBe("allowed");
    expect((await gate(contacts[0], "user")).data?.decision).toBe("allowed");
    expect((await gate(contacts[1], "user")).data).toMatchObject({ decision: "blocked", checks: { daily_limit: { ok: false, limit: 3 } } });

    await ownerA.client.from("organization_settings").update({ evolution_daily_proactive_limit: 30 }).eq("tenant_id", orgA.id);
    expect((await gate(contacts[0], "user")).data).toMatchObject({ decision: "blocked", checks: { frequency: { ok: false } } });
    expect((await ownerA.client.from("organization_settings").update({ evolution_daily_proactive_limit: 50 }).eq("tenant_id", orgA.id)).error).not.toBeNull();
  });

  it("dentro da janela, a resposta vale para qualquer origem", async () => {
    const id = `wamid.${randomUUID()}`;
    const { queued } = await ingestEvents([
      { kind: "message", dedupeKey: `evo:msg:${id}`, phoneNumberId: evolution.phone_number_id, contactPhone: "+5511922220021", profileName: "Evo janela", waMessageId: id, type: "text", body: "Oi", media: null, occurredAt: new Date().toISOString() },
    ]);
    await processEvents(queued);
    const contactId = await contactByPhone(orgA.id, "+5511922220021");
    expect((await gate(contactId, "agent")).data).toMatchObject({ decision: "allowed", proactive: false });
  });
});
