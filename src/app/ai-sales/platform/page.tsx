import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { CreateOrganizationForm, ReissueOwnerInviteForm } from "@/components/ai-sales/platform-forms";
import { Empty, formatDateTime, Notice, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requirePlatformAdmin } from "@/features/ai-sales/auth/dal";
import { isPlatformMfaRequired } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { setOrganizationStatus } from "./actions";

export const metadata: Metadata = { title: "Plataforma" };

async function PlatformContent() {
  await requirePlatformAdmin();
  // Superadmin não tem policy de leitura: a consulta usa a secret key,
  // depois da checagem acima. Só metadados das empresas, nunca dados comerciais.
  const db = createSalesServiceClient();
  const [{ data: organizations }, { data: members }, { data: logs }] = await Promise.all([
    db.from("organizations").select("id, slug, name, document, status, status_reason, created_at").order("name"),
    db.from("organization_members").select("tenant_id, role, status"),
    db.from("audit_logs").select("id, action, entity_type, reason, created_at, tenant_id").eq("actor_type", "platform_admin").order("created_at", { ascending: false }).limit(20),
  ]);
  const counts = new Map<string, { total: number; owners: number }>();
  for (const member of members ?? []) {
    if (member.status !== "active") continue;
    const entry = counts.get(member.tenant_id) ?? { total: 0, owners: 0 };
    entry.total += 1;
    if (member.role === "owner") entry.owners += 1;
    counts.set(member.tenant_id, entry);
  }
  const nameById = new Map((organizations ?? []).map((org) => [org.id, org.name]));

  return (
    <>
      <PageHeading title="Empresas" description="Cadastro e suspensão de empresas. Ações registradas na auditoria com autor e motivo." />
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
                          {org.name} <StatusBadge status={org.status} />
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

        <Panel title="Ações recentes da plataforma">
          {!logs?.length ? (
            <Empty>Nenhuma ação registrada.</Empty>
          ) : (
            <ol className="divide-y divide-border text-sm">
              {logs.map((log) => (
                <li key={log.id} className="py-2.5">
                  <span className="font-medium">{log.entity_type}</span> · {log.action}
                  {log.tenant_id && nameById.get(log.tenant_id) && <span> · {nameById.get(log.tenant_id)}</span>}
                  {log.reason && <span className="text-muted-foreground"> · {log.reason}</span>}
                  <span className="text-muted-foreground"> · {formatDateTime(log.created_at)}</span>
                </li>
              ))}
            </ol>
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
