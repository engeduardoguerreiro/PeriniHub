import type { Metadata } from "next";
import { Suspense } from "react";

import { PageFallback } from "@/components/ai-sales/page-fallback";
import { PlanForm } from "@/components/ai-sales/platform-billing";
import { Notice, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { formatMetric, formatPlanPrice, METRIC_LABELS, PLAN_METRICS } from "@/features/ai-sales/billing/limits";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

export const metadata: Metadata = { title: "Planos · Plataforma" };

async function PlansContent() {
  await requirePlatformAdmin();
  const db = createSalesServiceClient();
  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    db.from("subscription_plans").select("*").order("created_at"),
    db.from("subscriptions").select("plan_code"),
  ]);
  const inUse = new Map<string, number>();
  for (const item of subscriptions ?? []) inUse.set(item.plan_code, (inUse.get(item.plan_code) ?? 0) + 1);

  return (
    <>
      <PageHeading title="Planos" description="Limites aplicados pelo banco. Métrica sem valor = recurso não incluído. Preço sem marcação de definitivo aparece como provisório." />
      <div className="mb-6">
        <Notice tone="warning">Preços ainda não validados comercialmente: mantenha-os provisórios até a decisão comercial de preços.</Notice>
      </div>
      <div className="grid gap-6">
        {(plans ?? []).map((plan) => {
          const limits = ((plan.entitlements as { limits?: Record<string, number> }).limits ?? {}) as Record<string, number>;
          return (
            <Panel
              key={plan.code}
              title={`${plan.name} (${plan.code})`}
              description={`${formatPlanPrice(plan.price_monthly_cents, plan.price_is_final)} · ${inUse.get(plan.code) ?? 0} empresa(s)${plan.is_public ? " · público" : ""}`}
              actions={<StatusBadge status={plan.active ? "active" : "closed"} label={plan.active ? "Ativo" : "Inativo"} />}
            >
              <dl className="mb-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {PLAN_METRICS.map((metric) => (
                  <div key={metric} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{METRIC_LABELS[metric]}</dt>
                    <dd>{metric in limits ? formatMetric(metric, limits[metric]) : "não incluído"}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">Editar plano</summary>
                <div className="mt-4">
                  <PlanForm
                    values={{
                      code: plan.code,
                      name: plan.name,
                      description: plan.description,
                      limits,
                      priceCents: plan.price_monthly_cents,
                      priceIsFinal: plan.price_is_final,
                      isPublic: plan.is_public,
                      active: plan.active,
                    }}
                  />
                </div>
              </details>
            </Panel>
          );
        })}
        <Panel title="Novo plano">
          <PlanForm />
        </Panel>
      </div>
    </>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PlansContent />
    </Suspense>
  );
}
