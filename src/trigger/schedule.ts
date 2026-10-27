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
 * Quantos artigos novos ainda podem ser redigidos hoje: no máximo o limite
 * diário de publicação. É o principal controle de consumo de IA (medido:
 * ~US$ 0,05 por artigo entre redação, verificação e SEO; 3/dia ≈ US$ 4,60/mês).
 */
export function writingCapacity(dailyPublicationLimit: number, draftsCreatedToday: number) {
  return Math.max(0, dailyPublicationLimit - draftsCreatedToday);
}
