import type { Metadata } from "next";
import { Suspense } from "react";

import { Empty, formatDateTime, Notice, Panel } from "@/components/ai-sales/ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { can } from "@/features/ai-sales/auth/roles";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export const metadata: Metadata = { title: "Auditoria" };

const ENTITY_LABELS: Record<string, string> = {
  organizations: "Empresa",
  organization_members: "Membro",
  organization_invites: "Convite",
  organization_settings: "Configurações",
  subscriptions: "Plano",
};
const ACTION_LABELS: Record<string, string> = { insert: "criou", update: "alterou", delete: "removeu" };
const ACTOR_LABELS: Record<string, string> = { user: "Usuário", platform_admin: "Plataforma", system: "Sistema", agent: "Agente" };

function describeDiff(diff: unknown) {
  if (!diff || typeof diff !== "object" || !("new" in diff)) return null;
  const changes = (diff as { new: Record<string, unknown> }).new;
  return Object.entries(changes)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

async function AuditPageContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/auditoria">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  if (!can(membership.role, "audit.read")) return <Notice>Só proprietários e administradores veem a auditoria.</Notice>;

  const db = await createSalesSessionClient();
  const { data: logs } = await db
    .from("audit_logs")
    .select("id, actor_type, actor_id, action, entity_type, diff, reason, created_at")
    .eq("tenant_id", membership.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = actorIds.length ? await db.from("user_profiles").select("user_id, email").in("user_id", actorIds) : { data: [] };
  const emailById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.email]));

  return (
    <Panel title="Histórico de alterações" description="Últimas 100 ações administrativas. Registro permanente, não editável.">
      {!logs?.length ? (
        <Empty>Nenhum registro ainda.</Empty>
      ) : (
        <ol className="divide-y divide-border text-sm">
          {logs.map((log) => (
            <li key={log.id} className="grid gap-1 py-3">
              <p>
                <span className="font-medium">{(log.actor_id && emailById.get(log.actor_id)) || ACTOR_LABELS[log.actor_type]}</span>{" "}
                {ACTION_LABELS[log.action] ?? log.action} {(ENTITY_LABELS[log.entity_type] ?? log.entity_type).toLowerCase()}
                <span className="text-muted-foreground"> · {formatDateTime(log.created_at)}</span>
              </p>
              {log.action === "update" && <p className="truncate text-xs text-muted-foreground">{describeDiff(log.diff)}</p>}
              {log.reason && <p className="text-xs text-muted-foreground">Motivo: {log.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// Suspense próprio da página: na navegação entre telas o layout fica e só o
// conteúdo mostra o esqueleto enquanto a sessão e os dados carregam.
export default function AuditPage({ params }: PageProps<"/ai-sales/[org]/settings/auditoria">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditPageContent params={params} />
    </Suspense>
  );
}
