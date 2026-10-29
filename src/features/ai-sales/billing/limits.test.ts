import { describe, expect, it } from "vitest";

import { formatPlanPrice, limitsFromForm, usageLevel, usagePercent, usageWarnings } from "./limits";

describe("limites do plano", () => {
  it("nível de uso: ok, aviso a partir de 80%, cheio e bloqueado", () => {
    expect(usageLevel({ used: 5, reserved: 0, limit_value: 10 })).toBe("ok");
    expect(usageLevel({ used: 7, reserved: 1, limit_value: 10 })).toBe("warning");
    expect(usageLevel({ used: 10, reserved: 0, limit_value: 10 })).toBe("full");
    expect(usageLevel({ used: 0, reserved: 0, limit_value: null })).toBe("blocked");
    expect(usageLevel({ used: 0, reserved: 0, limit_value: 0 })).toBe("blocked");
    expect(usagePercent({ used: 15, reserved: 0, limit_value: 10 })).toBe(100);
  });

  it("avisos só para métricas em aviso ou cheias", () => {
    const rows = [
      { metric: "leads", kind: "count", used: 9, reserved: 0, limit_value: 10 },
      { metric: "agents", kind: "count", used: 1, reserved: 0, limit_value: 4 },
      { metric: "whatsapp_messages", kind: "monthly", used: 0, reserved: 0, limit_value: null },
    ];
    expect(usageWarnings(rows).map((row) => [row.metric, row.level])).toEqual([["leads", "warning"]]);
  });

  it("preço nunca aparece como definitivo sem marcação", () => {
    expect(formatPlanPrice(null, false)).toBe("Preço a definir");
    expect(formatPlanPrice(19900, false)).toMatch(/199,00\/mês \(provisório\)$/);
    expect(formatPlanPrice(19900, true)).toMatch(/199,00\/mês$/);
  });

  it("lê limites do formulário", () => {
    const form = new FormData();
    form.set("limit_leads", "1000");
    form.set("limit_ai_cost_usd", "5,5");
    form.set("limit_agents", "");
    expect(limitsFromForm(form)).toEqual({ ok: true, limits: { leads: 1000, ai_cost_usd: 5.5 } });
    form.set("limit_members", "-1");
    expect(limitsFromForm(form)).toMatchObject({ ok: false });
  });
});
