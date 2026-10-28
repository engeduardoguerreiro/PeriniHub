import { describe, expect, it } from "vitest";

import { numberIdFromInstance, parseEvolutionWebhook } from "./evolution";

const NUMBER = "11111111-2222-4333-8444-555555555555";
const instance = `ais-${NUMBER}`;

describe("webhook da Evolution", () => {
  it("só aceita instâncias do AI Sales (ais-), nunca as do PeriniFood (pf-)", () => {
    expect(numberIdFromInstance(instance)).toBe(NUMBER);
    expect(numberIdFromInstance(`pf-${NUMBER}`)).toBeNull();
    expect(parseEvolutionWebhook({ event: "messages.upsert", instance: `pf-${NUMBER}`, data: {} })).toEqual({ events: [], connection: null });
  });

  it("mensagem recebida vira evento igual ao do webhook oficial", () => {
    const { events } = parseEvolutionWebhook({
      event: "messages.upsert",
      instance,
      data: { key: { id: "3EB0A", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false }, pushName: "Ana", messageTimestamp: 1750000000, message: { conversation: "Oi" } },
    });
    expect(events).toEqual([
      { kind: "message", dedupeKey: `evo:msg:${NUMBER}:3EB0A`, phoneNumberId: `evolution-${NUMBER}`, contactPhone: "+5511987654321", profileName: "Ana", waMessageId: "3EB0A", type: "text", body: "Oi", media: null, occurredAt: "2025-06-15T15:06:40.000Z" },
    ]);
  });

  it("mensagem da própria empresa (fromMe) é eco; grupos e status são ignorados", () => {
    const { events } = parseEvolutionWebhook({
      event: "MESSAGES_UPSERT",
      instance,
      data: [
        { key: { id: "A", remoteJid: "5511987654321@s.whatsapp.net", fromMe: true }, message: { extendedTextMessage: { text: "Resposta" } } },
        { key: { id: "B", remoteJid: "120363@g.us", fromMe: false }, message: { conversation: "grupo" } },
        { key: { id: "C", remoteJid: "status@broadcast" }, message: { conversation: "status" } },
      ],
    });
    expect(events.map((event) => [event.kind, event.waMessageId])).toEqual([["echo", "A"]]);
  });

  it("status de entrega e conexão", () => {
    expect(parseEvolutionWebhook({ event: "messages.update", instance, data: { keyId: "A", status: "READ" } }).events).toEqual([
      expect.objectContaining({ kind: "status", status: "read", waMessageId: "A", dedupeKey: `evo:status:${NUMBER}:A:read` }),
    ]);
    expect(parseEvolutionWebhook({ event: "messages.update", instance, data: { keyId: "A", status: "WHATEVER" } }).events).toEqual([]);
    expect(parseEvolutionWebhook({ event: "connection.update", instance, data: { state: "open" } }).connection).toEqual({ numberId: NUMBER, state: "open" });
  });
});
