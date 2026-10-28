import type { Metadata } from "next";
import { Suspense } from "react";

import { OrganizationForm } from "@/components/ai-sales/settings-forms";
import { Notice, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { can } from "@/features/ai-sales/auth/roles";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export const metadata: Metadata = { title: "Empresa" };

async function OrganizationPageContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/empresa">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const manage = can(membership.role, "settings.manage");
  const db = await createSalesSessionClient();
  const [{ data: organization }, { data: settings }, { data: subscription }] = await Promise.all([
    db.from("organizations").select("name, legal_name, document, slug").eq("id", membership.tenantId).single(),
    db.from("organization_settings").select("timezone, sales_visibility").eq("tenant_id", membership.tenantId).single(),
    can(membership.role, "billing.read")
      ? db.from("subscriptions").select("status, plan:subscription_plans(name, entitlements)").eq("tenant_id", membership.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!organization || !settings) return <Notice tone="warning">Não foi possível carregar os dados da empresa.</Notice>;
  const limits = (subscription?.plan?.entitlements as { limits?: Record<string, number> } | null)?.limits ?? {};

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
        <Panel title="Plano" description="Cobrança manual. Limites aplicados pelo banco.">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{subscription.plan?.name}</span>
            <StatusBadge status={subscription.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Membros</dt>
              <dd className="font-medium">{limits.members ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Leads</dt>
              <dd className="font-medium">{limits.leads?.toLocaleString("pt-BR") ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">IA e WhatsApp</dt>
              <dd className="font-medium">Liberados nas fases 3 e 4</dd>
            </div>
          </dl>
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
