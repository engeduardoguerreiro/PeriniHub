import type { Metadata } from "next";
import { Suspense } from "react";

import { OrganizationForm } from "@/components/ai-sales/settings-forms";
import { Empty, Notice, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { UsageTable, UsageWarnings } from "@/components/ai-sales/usage";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { can } from "@/features/ai-sales/auth/roles";
import { INVOICE_STATUS, SUBSCRIPTION_STATUS_LABELS } from "@/features/ai-sales/billing/labels";
import { formatCentsBRL, formatPlanPrice } from "@/features/ai-sales/billing/limits";
import { loadUsage } from "@/features/ai-sales/billing/queries";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export const metadata: Metadata = { title: "Empresa" };

async function OrganizationPageContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/empresa">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const manage = can(membership.role, "settings.manage");
  const db = await createSalesSessionClient();
  const billing = can(membership.role, "billing.read");
  const [{ data: organization }, { data: settings }, { data: subscription }, { data: invoices }, usage] = await Promise.all([
    db.from("organizations").select("name, legal_name, document, slug").eq("id", membership.tenantId).single(),
    db.from("organization_settings").select("timezone, sales_visibility").eq("tenant_id", membership.tenantId).single(),
    billing
      ? db.from("subscriptions").select("status, current_period_end, plan:subscription_plans(name, price_monthly_cents, price_is_final)").eq("tenant_id", membership.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    billing
      ? db.from("billing_invoices").select("id, number, description, amount_cents, status, due_date, paid_at").eq("tenant_id", membership.tenantId).order("created_at", { ascending: false }).limit(24)
      : Promise.resolve({ data: null }),
    billing ? loadUsage(db, membership.tenantId) : Promise.resolve([]),
  ]);
  if (!organization || !settings) return <Notice tone="warning">Não foi possível carregar os dados da empresa.</Notice>;

  return (
    <div className="grid gap-6">
      <Panel title="Dados da empresa" description={`Identificador: ${organization.slug}${organization.document ? ` · CNPJ ${organization.document}` : ""}`}>
        {!manage && (
          <div className="mb-4">
            <Notice>Só proprietários e administradores alteram estes dados.</Notice>
          </div>
        )}
        <OrganizationForm
          slug={org}
          readOnly={!manage}
          values={{ name: organization.name, legalName: organization.legal_name, timezone: settings.timezone, salesVisibility: settings.sales_visibility }}
        />
      </Panel>
      {subscription && (
        <Panel
          title="Plano e consumo"
          description={`${formatPlanPrice(subscription.plan?.price_monthly_cents ?? null, subscription.plan?.price_is_final ?? false)} · cobrança manual. Ao atingir um limite, o sistema recusa novas criações.`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{subscription.plan?.name}</span>
            <StatusBadge status={subscription.status === "past_due" || subscription.status === "canceled" ? "suspended" : "active"} label={`Assinatura ${SUBSCRIPTION_STATUS_LABELS[subscription.status]}`} />
          </div>
          <div className="mb-4">
            <UsageWarnings rows={usage} />
          </div>
          <UsageTable rows={usage} />
        </Panel>
      )}
      {billing && (
        <Panel title="Cobranças">
          {invoices?.length ? (
            <ul className="divide-y divide-border text-sm">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{invoice.number}</span> · {invoice.description} · {formatCentsBRL(invoice.amount_cents)} · vence{" "}
                    {new Date(`${invoice.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                  <StatusBadge status={INVOICE_STATUS[invoice.status].tone} label={INVOICE_STATUS[invoice.status].label} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhuma cobrança emitida.</Empty>
          )}
        </Panel>
      )}
    </div>
  );
}

// Suspense próprio da página: na navegação entre telas o layout fica e só o
// conteúdo mostra o esqueleto enquanto a sessão e os dados carregam.
export default function OrganizationPage({ params }: PageProps<"/ai-sales/[org]/settings/empresa">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <OrganizationPageContent params={params} />
    </Suspense>
  );
}
