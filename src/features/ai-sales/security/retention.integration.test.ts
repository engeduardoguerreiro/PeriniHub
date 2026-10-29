import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFixtures, type TestUser } from "../testing/fixtures";

// Retenção (Fase 8): payload de webhook antigo é apagado e o registro fica;
// conteúdo de execução antiga de agente some e custo/status ficam; convite
// vencido há mais do prazo é apagado.

const fx = createFixtures("ret");

let owner: TestUser;
let org: { id: string };

beforeAll(async () => {
  owner = await fx.createUser("owner");
  org = await fx.createOrg("ret", owner);
});
afterAll(async () => {
  await fx.service.from("webhook_events").delete().like("dedupe_key", `zz-ret-${fx.tag}%`);
  await fx.cleanup();
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe("retenção de dados operacionais", () => {
  it("apaga payload antigo e mantém o recente; apaga convite vencido", async () => {
    const old = `zz-ret-${fx.tag}-old`;
    const recent = `zz-ret-${fx.tag}-new`;
    const stale = `zz-ret-${fx.tag}-stale`;
    await fx.service.from("webhook_events").insert([
      { dedupe_key: old, tenant_id: org.id, kind: "message", payload: { body: "conteúdo" }, status: "processed", received_at: daysAgo(40) },
      { dedupe_key: recent, tenant_id: org.id, kind: "message", payload: { body: "conteúdo" }, status: "processed", received_at: daysAgo(2) },
      { dedupe_key: stale, tenant_id: org.id, kind: "message", payload: {}, status: "processed", received_at: daysAgo(200) },
    ]);
    const invite = await fx.service
      .from("organization_invites")
      .insert({ tenant_id: org.id, email_normalized: `zz-ret-${randomUUID().slice(0, 8)}@teste.perinihub.local`, role: "viewer", token_hash: randomUUID().replace(/-/g, "").padEnd(64, "0"), expires_at: daysAgo(45) })
      .select("id")
      .single();
    expect(invite.error).toBeNull();

    for (let round = 0; round < 50; round++) {
      const { data, error } = await fx.service.rpc("apply_retention", { p_batch: 5000 });
      expect(error).toBeNull();
      if (Object.values(data as Record<string, number>).every((value) => value === 0)) break;
    }

    const { data: events } = await fx.service.from("webhook_events").select("dedupe_key, payload").like("dedupe_key", `zz-ret-${fx.tag}%`);
    const byKey = Object.fromEntries((events ?? []).map((event) => [event.dedupe_key, event.payload]));
    expect(byKey[old]).toEqual({});
    expect(byKey[recent]).toEqual({ body: "conteúdo" });
    expect(stale in byKey).toBe(false);
    const { data: gone } = await fx.service.from("organization_invites").select("id").eq("id", invite.data!.id);
    expect(gone).toHaveLength(0);
  });
});
