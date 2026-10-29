import type { Metadata } from "next";
import { Suspense } from "react";

import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, PageHeading, Panel } from "@/components/ai-sales/ui";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

export const metadata: Metadata = { title: "Auditoria · Plataforma" };

const ENTITY_LABELS: Record<string, string> = {
  organizations: "Empresa",
  subscriptions: "Assinatura",
  subscription_plans: "Plano",
  billing_invoices: "Cobrança",
  organization_invites: "Convite",
  organization_members: "Membro",
  platform_admins: "Superadmin",
};

async function AuditContent() {
  await requirePlatformAdmin();
  const db = createSalesServiceClient();
  const [{ data: logs }, { data: organizations }] = await Promise.all([
    db.from("audit_logs").select("id, action, entity_type, entity_id, reason, created_at, tenant_id, actor_id, diff").eq("actor_type", "platform_admin").order("created_at", { ascending: false }).limit(200),
    db.from("organizations").select("id, name"),
  ]);
  const nameById = new Map((organizations ?? []).map((org) => [org.id, org.name]));

  return (
    <>
      <PageHeading title="Auditoria da plataforma" description="Últimas 200 ações do superadmin, com motivo. Registro somente de inclusão." />
      <Panel title="Ações">
        {!logs?.length ? (
          <Empty>Nenhuma ação registrada.</Empty>
        ) : (
          <ol className="divide-y divide-border text-sm">
            {logs.map((log) => {
              const changed = log.action === "update" && log.diff && typeof log.diff === "object" ? Object.keys(((log.diff as { new?: object }).new ?? {}) as object) : [];
              return (
                <li key={log.id} className="py-2.5">
                  <span className="font-medium">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</span> · {log.action}
                  {changed.length > 0 && <span className="text-muted-foreground"> ({changed.join(", ")})</span>}
                  {log.tenant_id && nameById.get(log.tenant_id) && <span> · {nameById.get(log.tenant_id)}</span>}
                  {log.reason && <span className="text-muted-foreground"> · motivo: {log.reason}</span>}
                  <span className="text-muted-foreground"> · {formatDateTime(log.created_at)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </>
  );
}

export default function PlatformAuditPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditContent />
    </Suspense>
  );
}
