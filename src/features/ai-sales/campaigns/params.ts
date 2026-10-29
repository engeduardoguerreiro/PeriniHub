// Variáveis dos templates de campanha: {{nome}} (primeiro nome) e
// {{empresa}} (empresa do contato). O resto é texto fixo.

export function renderParameters(parameters: unknown, contact: { full_name: string; company?: { name: string } | null }) {
  const list = Array.isArray(parameters) ? parameters.map(String) : [];
  const first = contact.full_name.trim().split(/\s+/)[0] ?? "";
  return list.map((value) =>
    value
      .replace(/\{\{\s*nome\s*\}\}/gi, first)
      .replace(/\{\{\s*empresa\s*\}\}/gi, contact.company?.name ?? "")
      .trim()
      .slice(0, 500),
  );
}

/** Horário local "HH:MM" no fuso da empresa. */
export function localTime(timeZone: string, now = Date.now()) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);
}

export function inSendWindow(windowStart: string, windowEnd: string, timeZone: string, now = Date.now()) {
  const current = localTime(timeZone, now);
  return current >= windowStart.slice(0, 5) && current < windowEnd.slice(0, 5);
}
