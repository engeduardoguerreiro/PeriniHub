import { localDate, localTime } from "@/agents/types";

// Regras do agendador, sem dependência do Trigger.dev (testáveis).

export const SCHEDULER_INTERVAL_MINUTES = 15;

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Horários de coleta (HH:MM no fuso editorial) que caem na janela do tick
 * atual do agendador. Cada horário dispara uma única vez por dia: a chave de
 * idempotência inclui a data local e o horário.
 */
export function dueCollectionSlots(scheduleTimes: string[], timeZone: string, now = Date.now()) {
  const current = minutesOf(localTime(timeZone, now));
  const date = localDate(timeZone, now);
  return scheduleTimes
    .filter((time) => {
      const diff = current - minutesOf(time);
      return diff >= 0 && diff < SCHEDULER_INTERVAL_MINUTES;
    })
    .map((time) => ({ time, key: `collect:${date}:${time}` }));
}

/**
 * Quantos artigos novos ainda podem ser redigidos hoje. Escreve um pouco além
 * do limite de publicação (folga para reprovações), mas nunca sem teto:
 * é o principal controle de consumo de IA.
 */
export function writingCapacity(dailyPublicationLimit: number, draftsCreatedToday: number) {
  const budget = dailyPublicationLimit === 0 ? 0 : dailyPublicationLimit + 2;
  return Math.max(0, budget - draftsCreatedToday);
}
