import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { CreateOrganizationForm, ReissueOwnerInviteForm } from "@/components/ai-sales/platform-forms";
import { Empty, formatDateTime, Notice, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { UsageWarnings } from "@/components/ai-sales/usage";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { SUBSCRIPTION_STATUS_LABELS } from "@/features/ai-sales/billing/labels";
import { loadUsage } from "@/features/ai-sales/billing/queries";
import { isPlatformMfaRequired } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { setOrganizationStatus } from "./actions";

export const metadata: Metadata = { title: "Plataforma" };

async function PlatformContent() {
  await requirePlatformAdmin();
  // Superadmin não tem policy de leitura: a consulta usa a secret key,
  // depois da checagem acima. Só metadados das empresas, nunca dados comerciais.
  const db = createSalesServiceClient();
  const [{ data: organizations }, { data: members }, { data: subscriptions }] = await Promise.all([
    db.from("organizations").select("id, slug, name, document, status, status_reason, created_at").order("name"),
    db.from("organization_members").select("tenant_id, role, status"),
    db.from("subscriptions").select("tenant_id, status, plan:subscription_plans(name)"),
  ]);
  const subscriptionByTenant = new Map((subscriptions ?? []).map((item) => [item.tenant_id, item]));
  const usageByTenant = new Map(await Promise.all((organizations ?? []).map(async (org) => [org.id, await loadUsage(db, org.id)] as const)));
  const counts = new Map<string, { total: number; owners: number }>();
  for (const member of members ?? []) {
    if (member.status !== "active") continue;
    const entry = counts.get(member.tenant_id) ?? { total: 0, owners: 0 };
    entry.total += 1;
    if (member.role === "owner") entry.owners += 1;
    counts.set(member.tenant_id, entry);
  }

  return (
    <>
      <PageHeading title="Empresas" description="Cadastro, suspensão, plano e cobrança de cada empresa. Ações registradas na auditoria com autor e motivo." />
      {!isPlatformMfaRequired() && (
        <div className="mb-6">
          <Notice tone="warning">
            Segundo fator (MFA) ainda não é exigido no painel da plataforma. Ative antes de atender clientes externos (decisão D-16).
          </Notice>
        </div>
      )}

      <div className="grid gap-6">
        <Panel title="Nova empresa">
          <CreateOrganizationForm />
        </Panel>

        <Panel title="Empresas cadastradas" description={`${organizations?.length ?? 0} empresa(s).`}>
          {!organizations?.length ? (
            <Empty>Nenhuma empresa cadastrada.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {organizations.map((org) => {
                const count = counts.get(org.id) ?? { total: 0, owners: 0 };
                return (
                  <li key={org.id} className="grid gap-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <Link href={`/ai-sales/platform/empresas/${org.id}`} className="hover:text-primary hover:underline">
                            {org.name}
                          </Link>
                          <StatusBadge status={org.status} />
                          <UsageWarnings rows={usageByTenant.get(org.id) ?? []} compact />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Plano {subscriptionByTenant.get(org.id)?.plan?.name ?? "—"} · assinatura{" "}
                          {SUBSCRIPTION_STATUS_LABELS[subscriptionByTenant.get(org.id)?.status ?? "internal"]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          /{org.slug} · {count.total} membro(s) · criada em {formatDateTime(org.created_at)}
                          {org.document && ` · CNPJ ${org.document}`}
                        </p>
                        {org.status !== "active" && org.status_reason && <p className="text-xs text-muted-foreground">Motivo: {org.status_reason}</p>}
                      </div>
                      {org.status === "active" ? (
                        <ActionButton
                          variant="danger"
                          action={setOrganizationStatus.bind(null, org.id, "suspended")}
                          confirm={{ title: `Suspender ${org.name}?`, description: "Os membros perdem o acesso aos dados até a reativação. Nada é apagado.", confirmLabel: "Suspender", reason: true }}
                        >
                          Suspender
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={setOrganizationStatus.bind(null, org.id, "active")}
                          confirm={{ title: `Reativar ${org.name}?`, description: "Os membros voltam a acessar a empresa.", confirmLabel: "Reativar", reason: true }}
                        >
                          Reativar
                        </ActionButton>
                      )}
                    </div>
                    {count.owners === 0 && org.status === "active" && (
                      <div className="grid gap-2 rounded-xl border border-dashed border-border p-3">
                        <p className="text-xs text-muted-foreground">Sem proprietário ativo: o convite ainda não foi aceito. Gere outro se ele expirou.</p>
                        <ReissueOwnerInviteForm tenantId={org.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

      </div>
    </>
  );
}

export default function PlatformPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PlatformContent />
    </Suspense>
  );
}
