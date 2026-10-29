import "server-only";

import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { templateBody } from "../whatsapp/templates";

/** Números oficiais (ou simulado) ativos e seus templates aprovados, para campanhas e follow-up. */
export async function loadSendOptions(tenantId: string) {
  const db = await createSalesSessionClient();
  const [{ data: numbers }, { data: templates }] = await Promise.all([
    db.from("whatsapp_phone_numbers").select("id, account_id, display_phone, account:whatsapp_accounts(provider)").eq("tenant_id", tenantId).eq("status", "active"),
    db.from("whatsapp_templates").select("id, account_id, name, category, components").eq("tenant_id", tenantId).eq("status", "APPROVED").order("name"),
  ]);
  return {
    numbers: (numbers ?? [])
      .filter((number) => number.account?.provider !== "evolution")
      .map((number) => ({ id: number.id, accountId: number.account_id, name: `${number.display_phone}${number.account?.provider === "sandbox" ? " (simulado)" : ""}` })),
    templates: (templates ?? []).map((template) => ({ id: template.id, accountId: template.account_id, name: template.name, category: template.category, body: templateBody(template.components) })),
  };
}
