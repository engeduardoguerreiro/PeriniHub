import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { InviteForm, RoleSelect } from "@/components/ai-sales/settings-forms";
import { Empty, formatDateTime, Notice, Panel, RoleBadge, StatusBadge } from "@/components/ai-sales/ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { assignableRoles, can, ROLE_LABELS } from "@/features/ai-sales/auth/roles";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { removeMember, revokeInvite, setMemberStatus } from "../actions";

export const metadata: Metadata = { title: "Membros" };

// Página dinâmica (renderizada por requisição): comparar com o relógio aqui é seguro.
function isExpired(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

async function MembersPageContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/membros">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const manage = can(membership.role, "members.manage");
  const roles = assignableRoles(membership.role);
  const db = await createSalesSessionClient();

  const { data: members } = await db
    .from("organization_members")
    .select("user_id, role, status, created_at")
    .eq("tenant_id", membership.tenantId)
    .order("created_at");
  const ids = (members ?? []).map((member) => member.user_id);
  const [{ data: profiles }, { data: invites }] = await Promise.all([
    ids.length ? db.from("user_profiles").select("user_id, email, full_name").in("user_id", ids) : Promise.resolve({ data: [] }),
    manage
      ? db
          .from("organization_invites")
          .select("id, email_normalized, role, expires_at, created_at")
          .eq("tenant_id", membership.tenantId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  return (
    <div className="grid gap-6">
      {manage ? (
        <Panel title="Convidar pessoa" description="O convite gera um link de uso único. Envie para a pessoa; só o e-mail convidado consegue aceitar.">
          <InviteForm slug={org} roles={roles} />
        </Panel>
      ) : (
        <Notice>Só proprietários e administradores convidam e alteram membros.</Notice>
      )}

      <Panel title="Membros" description={`${members?.length ?? 0} pessoa(s) com acesso a ${membership.name}.`}>
        {!members?.length ? (
          <Empty>Nenhum membro.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((member) => {
              const profile = profileById.get(member.user_id);
              const self = member.user_id === membership.user.id;
              const editable = manage && !self && (member.role !== "owner" || membership.role === "owner");
              const name = profile?.full_name || profile?.email || "Usuário";
              return (
                <li key={member.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {name}
                      {self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </p>
                    {profile?.full_name && <p className="truncate text-xs text-muted-foreground">{profile.email}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {member.status !== "active" && <StatusBadge status={member.status} />}
                    {editable ? (
                      <>
                        <RoleSelect slug={org} userId={member.user_id} role={member.role} roles={roles} label={`Papel de ${name}`} />
                        <ActionButton action={setMemberStatus.bind(null, org, member.user_id, member.status !== "active")}>
                          {member.status === "active" ? "Desativar" : "Reativar"}
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          action={removeMember.bind(null, org, member.user_id)}
                          confirm={{ title: "Remover membro?", description: `${name} perde o acesso a ${membership.name}. Dá para convidar de novo depois.`, confirmLabel: "Remover" }}
                        >
                          Remover
                        </ActionButton>
                      </>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {manage && (
        <Panel title="Convites pendentes">
          {!invites?.length ? (
            <Empty>Nenhum convite pendente.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((invite) => {
                const expired = isExpired(invite.expires_at);
                return (
                  <li key={invite.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invite.email_normalized}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[invite.role]} · {expired ? "expirou" : "expira"} em {formatDateTime(invite.expires_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={expired ? "expired" : "pending"} />
                      <ActionButton action={revokeInvite.bind(null, org, invite.id)}>Revogar</ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

// Suspense próprio da página: na navegação entre telas o layout fica e só o
// conteúdo mostra o esqueleto enquanto a sessão e os dados carregam.
export default function MembersPage({ params }: PageProps<"/ai-sales/[org]/settings/membros">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MembersPageContent params={params} />
    </Suspense>
  );
}
