import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { InvoiceForm, PayInvoiceForm, SubscriptionForm } from "@/components/ai-sales/platform-billing";
import { Empty, formatDateTime, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { UsageTable, UsageWarnings } from "@/components/ai-sales/usage";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { INVOICE_STATUS } from "@/features/ai-sales/billing/labels";
import { formatCentsBRL, formatPlanPrice } from "@/features/ai-sales/billing/limits";
import { loadUsage } from "@/features/ai-sales/billing/queries";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { setInvoiceStatus } from "../../billing-actions";

export const metadata: Metadata = { title: "Empresa · Plataforma" };

const isoDate = (value: string | null) => (value ? value.slice(0, 10) : null);
const day = (value: string | null) => (value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

async function OrganizationContent({ params }: Pick<PageProps<"/ai-sales/platform/empresas/[id]">, "params">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // Secret key depois da checagem do superadmin; só metadados comerciais.
  const db = createSalesServiceClient();
  const [{ data: org }, { data: subscription }, { data: plans }, { data: invoices }, { data: logs }, usage] = await Promise.all([
    db.from("organizations").select("id, name, slug, status").eq("id", id).maybeSingle(),
    db.from("subscriptions").select("*").eq("tenant_id", id).maybeSingle(),
    db.from("subscription_plans").select("code, name, active, price_monthly_cents, price_is_final").order("name"),
    db.from("billing_invoices").select("*").eq("tenant_id", id).order("created_at", { ascending: false }),
    db.from("audit_logs").select("id, action, entity_type, reason, created_at").eq("tenant_id", id).eq("actor_type", "platform_admin").order("created_at", { ascending: false }).limit(30),
    loadUsage(db, id),
  ]);
  if (!org || !subscription) notFound();
  const plan = plans?.find((item) => item.code === subscription.plan_code);

  return (
    <>
      <Link href="/ai-sales/platform" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Empresas
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{org.name}</h1>
        <StatusBadge status={org.status} />
      </div>
      <div className="mb-6">
        <UsageWarnings rows={usage} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-6">
          <Panel title="Assinatura" description={`Plano ${plan?.name ?? subscription.plan_code} · ${plan ? formatPlanPrice(plan.price_monthly_cents, plan.price_is_final) : ""}`}>
            <SubscriptionForm
              tenantId={org.id}
              plans={(plans ?? []).filter((item) => item.active || item.code === subscription.plan_code)}
              values={{
                planCode: subscription.plan_code,
                status: subscription.status,
                periodStart: isoDate(subscription.current_period_start),
                periodEnd: isoDate(subscription.current_period_end),
                overrides: subscription.limit_overrides as Record<string, number>,
                notes: subscription.notes,
              }}
            />
          </Panel>
          <Panel title="Cobranças (manual)" description="Rascunho → emitida → paga. Paga e cancelada são finais; correção = nova cobrança.">
            {invoices?.length ? (
              <ul className="mb-6 divide-y divide-border text-sm">
                {invoices.map((invoice) => {
                  const status = INVOICE_STATUS[invoice.status];
                  return (
                    <li key={invoice.id} className="grid gap-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-medium">{invoice.number}</span> · {invoice.description}
                        </span>
                        <StatusBadge status={status.tone} label={status.label} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCentsBRL(invoice.amount_cents)} · vence {day(invoice.due_date)}
                        {invoice.paid_at && ` · paga em ${formatDateTime(invoice.paid_at)} (${invoice.payment_method})`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {invoice.status === "draft" && (
                          <ActionButton
                            action={setInvoiceStatus.bind(null, invoice.id, "issued", null)}
                            confirm={{ title: `Emitir ${invoice.number}?`, description: "A cobrança passa a aparecer para o administrador da empresa.", confirmLabel: "Emitir", reason: true }}
                          >
                            Emitir
                          </ActionButton>
                        )}
                        {invoice.status === "issued" && <PayInvoiceForm invoiceId={invoice.id} />}
                        {(invoice.status === "draft" || invoice.status === "issued") && (
                          <ActionButton
                            variant="danger"
                            action={setInvoiceStatus.bind(null, invoice.id, "canceled", null)}
                            confirm={{ title: `Cancelar ${invoice.number}?`, description: "Não pode ser desfeito.", confirmLabel: "Cancelar cobrança", reason: true }}
                          >
                            Cancelar
                          </ActionButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mb-6">
                <Empty>Nenhuma cobrança.</Empty>
              </div>
            )}
            <InvoiceForm tenantId={org.id} />
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel title="Consumo × limite" description="Contagens agora; custo de IA e mensagens no mês corrente (UTC).">
            <UsageTable rows={usage} />
          </Panel>
          <Panel title="Ações da plataforma nesta empresa">
            {logs?.length ? (
              <ol className="divide-y divide-border text-sm">
                {logs.map((log) => (
                  <li key={log.id} className="py-2">
                    <span className="font-medium">{log.entity_type}</span> · {log.action}
                    {log.reason && <span className="text-muted-foreground"> · {log.reason}</span>}
                    <span className="text-muted-foreground"> · {formatDateTime(log.created_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Nenhuma ação registrada.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function PlatformOrganizationPage({ params }: PageProps<"/ai-sales/platform/empresas/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <OrganizationContent params={params} />
    </Suspense>
  );
}
