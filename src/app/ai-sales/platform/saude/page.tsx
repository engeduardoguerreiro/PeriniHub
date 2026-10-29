import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageFallback } from "@/components/ai-sales/page-fallback";
import { DataTable } from "@/components/ai-sales/crm-ui";
import { formatDateTime, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

export const metadata: Metadata = { title: "Saúde das integrações · Plataforma" };

// Só presença das variáveis (nunca o valor). Vale para este servidor (Vercel);
// o worker do Trigger.dev recebe as dele no deploy.
const CONFIG = [
  { label: "WhatsApp Cloud API (webhook)", names: ["WHATSAPP_APP_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"] },
  { label: "Evolution (não oficial)", names: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_WEBHOOK_SECRET"] },
  { label: "Anthropic (agentes)", names: ["AI_SALES_ANTHROPIC_API_KEY"] },
  { label: "Trigger.dev", names: ["TRIGGER_SECRET_KEY"] },
];

async function HealthContent() {
  await requirePlatformAdmin();
  const db = createSalesServiceClient();
  const [{ data: health, error }, { data: organizations }] = await Promise.all([
    db.rpc("platform_integration_health"),
    db.from("organizations").select("id, name, status").order("name"),
  ]);
  if (error) throw new Error(`Falha ao ler a saúde das integrações: ${error.message}`);
  const byTenant = new Map((health ?? []).map((row) => [row.tenant_id, row]));

  return (
    <>
      <PageHeading title="Saúde das integrações" description="Webhooks com falha, eventos parados, contas de WhatsApp com erro e execuções de agentes que falharam. Sem conteúdo de mensagens." />
      <div className="grid gap-6">
        <Panel title="Configuração deste servidor">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {CONFIG.map((item) => {
              const configured = item.names.every((name) => Boolean(process.env[name]));
              return (
                <li key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  {item.label}
                  <StatusBadge status={configured ? "active" : "disabled"} label={configured ? "Configurado" : "Não configurado"} />
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Por empresa">
          <DataTable head={["Empresa", "WhatsApp", "Webhooks (7 dias)", "Parados > 15 min", "Último webhook", "Agentes (24 h)", "Campanhas em execução"]}>
            {(organizations ?? []).map((org) => {
              const row = byTenant.get(org.id);
              const alert = row && (row.whatsapp_with_error > 0 || row.webhook_dead_letter_7d > 0 || row.webhook_pending_stale > 0 || row.agent_failed_24h > 0);
              return (
                <tr key={org.id} className="align-top">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/ai-sales/platform/empresas/${org.id}`} className="hover:text-primary hover:underline">
                      {org.name}
                    </Link>{" "}
                    {alert && <StatusBadge status="suspended" label="Atenção" />}
                  </td>
                  <td className="px-3 py-2">
                    {row?.whatsapp_accounts ?? 0} conta(s){row?.whatsapp_with_error ? `, ${row.whatsapp_with_error} com erro` : ""}
                    {row?.last_whatsapp_error && <p className="max-w-xs truncate text-xs text-muted-foreground" title={row.last_whatsapp_error}>{row.last_whatsapp_error}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {row?.webhook_failed_7d ?? 0} falha(s), {row?.webhook_dead_letter_7d ?? 0} descartado(s)
                  </td>
                  <td className="px-3 py-2">{row?.webhook_pending_stale ?? 0}</td>
                  <td className="px-3 py-2">{formatDateTime(row?.last_webhook_at)}</td>
                  <td className="px-3 py-2">
                    {row?.agent_failed_24h ?? 0} falha(s) de {row?.agent_runs_24h ?? 0}
                  </td>
                  <td className="px-3 py-2">{row?.campaigns_running ?? 0}</td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <HealthContent />
    </Suspense>
  );
}
