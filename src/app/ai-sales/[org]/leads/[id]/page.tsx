import type { Metadata } from "next";
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { ContactPermission, StageBadge } from "@/components/ai-sales/crm-ui";
import { ActivityForm, ConsentForm, LeadControls, OpportunityForm, SuppressForm, TaskForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import {
  ACTIVITY_LABELS,
  CHANNEL_LABELS,
  formatCents,
  LEGAL_BASIS_LABELS,
  OPPORTUNITY_LABELS,
  PURPOSE_LABELS,
  SUPPRESSION_LABELS,
} from "@/features/ai-sales/crm/labels";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { actorNames, getLead, loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

import { classifyLeadWithAi } from "../../agents-actions";
import { deleteLead, setOpportunityStatus, setTaskStatus } from "../../crm-actions";

export const metadata: Metadata = { title: "Lead" };

async function LeadContent({ params }: Pick<PageProps<"/ai-sales/[org]/leads/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [detail, options] = await Promise.all([getLead(membership.tenantId, id), loadCrmOptions(membership.tenantId)]);
  if (!detail) notFound();
  const { lead, activities, tasks, opportunities, consents, suppressions } = detail;
  const contact = lead.contact;
  const stage = options.stages.find((item) => item.id === lead.stage_id);
  const canWrite = roleAtLeast(membership.role, "sales");
  const canManage = roleAtLeast(membership.role, "manager");
  const whatsappSuppressed = suppressions.some((item) => item.channel === "whatsapp");
  const whatsappAuthorized = consents.some((item) => item.channel === "whatsapp" && item.is_valid);
  const names = await actorNames(activities.map((activity) => activity.actor_id));
  const personById = new Map(options.people.map((person) => [person.id, person.name]));

  return (
    <>
      <Link href={orgPath(org, "leads")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Leads
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {stage && <StageBadge name={stage.name} color={stage.color} />}
            {contact && <ContactPermission authorized={whatsappAuthorized} suppressed={whatsappSuppressed} />}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{contact?.full_name ?? lead.company?.name ?? "Lead"}</h1>
          {lead.title && <p className="mt-1 text-muted-foreground">{lead.title}</p>}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contact?.phone_e164 && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {formatPhone(contact.phone_e164)}
              </span>
            )}
            {contact?.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {contact.email}
              </span>
            )}
            {lead.company && (
              <Link href={orgPath(org, `companies/${lead.company.id}`)} className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {lead.company.name}
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact && (
            <Link href={orgPath(org, `contacts/${contact.id}`)} className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
              Ver contato
            </Link>
          )}
          {canWrite && <ActionButton action={classifyLeadWithAi.bind(null, org, lead.id)}>Classificar com IA</ActionButton>}
          {canManage && (
            <ActionButton
              variant="danger"
              action={deleteLead.bind(null, org, lead.id)}
              confirm={{ title: "Excluir lead?", description: "O lead sai das listas e do pipeline. A exclusão fica registrada na auditoria.", confirmLabel: "Excluir" }}
            >
              Excluir
            </ActionButton>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        <Panel title="Classificação comercial" description={`Na etapa atual desde ${formatDateTime(lead.stage_changed_at)}.`}>
          <LeadControls
            slug={org}
            leadId={lead.id}
            readOnly={!canWrite}
            stages={options.stages}
            people={options.people}
            values={{ stageId: lead.stage_id, ownerId: lead.owner_user_id, qualification: lead.qualification, score: lead.score, title: lead.title }}
          />
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Oportunidades">
            {opportunities.length ? (
              <ul className="mb-4 divide-y divide-border text-sm">
                {opportunities.map((opportunity) => (
                  <li key={opportunity.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium">{opportunity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCents(opportunity.amount_cents)} · {OPPORTUNITY_LABELS[opportunity.status]}
                        {opportunity.expected_close_date && opportunity.status === "open" && ` · previsão ${new Date(`${opportunity.expected_close_date}T12:00:00`).toLocaleDateString("pt-BR")}`}
                        {opportunity.lost_reason && ` · ${opportunity.lost_reason}`}
                      </p>
                    </div>
                    {canWrite && opportunity.status === "open" && (
                      <div className="flex gap-2">
                        <ActionButton action={setOpportunityStatus.bind(null, org, opportunity.id, "won")}>Ganha</ActionButton>
                        <ActionButton
                          variant="danger"
                          action={setOpportunityStatus.bind(null, org, opportunity.id, "lost")}
                          confirm={{ title: "Marcar como perdida?", description: "Informe o motivo para os relatórios.", confirmLabel: "Marcar perdida", reason: true }}
                        >
                          Perdida
                        </ActionButton>
                      </div>
                    )}
                    {canWrite && opportunity.status !== "open" && <ActionButton action={setOpportunityStatus.bind(null, org, opportunity.id, "open")}>Reabrir</ActionButton>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mb-4">
                <Empty>Nenhuma oportunidade. Crie uma quando houver proposta com valor.</Empty>
              </div>
            )}
            {canWrite && <OpportunityForm slug={org} leadId={lead.id} />}
          </Panel>

          <Panel title="Tarefas">
            {tasks.length ? (
              <ul className="mb-4 divide-y divide-border text-sm">
                {tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className={task.status !== "open" ? "text-muted-foreground line-through" : undefined}>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.due_at ? `Prazo ${formatDateTime(task.due_at)}` : "Sem prazo"}
                        {task.assignee_user_id && ` · ${personById.get(task.assignee_user_id) ?? "membro"}`}
                      </p>
                    </div>
                    {canWrite && (
                      <ActionButton action={setTaskStatus.bind(null, org, task.id, task.status === "open" ? "done" : "open")}>
                        {task.status === "open" ? "Concluir" : "Reabrir"}
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mb-4">
                <Empty>Nenhuma tarefa.</Empty>
              </div>
            )}
            {canWrite && <TaskForm slug={org} leadId={lead.id} people={options.people} defaultAssignee={membership.user.id} />}
          </Panel>
        </div>

        {contact && (
          <Panel title="Consentimento e privacidade" description="Autorização de contato por canal e finalidade. Independe da etapa comercial.">
            {suppressions.length > 0 && (
              <ul className="mb-4 grid gap-1 text-sm">
                {suppressions.map((item) => (
                  <li key={item.id} className="text-red-700 dark:text-red-300">
                    Descadastrado de {CHANNEL_LABELS[item.channel]}: {SUPPRESSION_LABELS[item.reason]} ({formatDateTime(item.created_at)})
                  </li>
                ))}
              </ul>
            )}
            {consents.length ? (
              <ul className="mb-4 divide-y divide-border text-sm">
                {consents.map((consent) => (
                  <li key={consent.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {CHANNEL_LABELS[consent.channel!]} · {PURPOSE_LABELS[consent.purpose!]}
                      <span className="text-muted-foreground">
                        {" "}
                        · {LEGAL_BASIS_LABELS[consent.legal_basis!]} · {consent.source}
                      </span>
                    </span>
                    <span className={consent.is_valid ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                      {consent.is_valid ? "Vigente" : "Revogado"} em {formatDateTime(consent.recorded_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mb-4">
                <Empty>Nenhum consentimento registrado: o contato não pode receber mensagens iniciadas pela empresa.</Empty>
              </div>
            )}
            {canWrite && (
              <div className="grid gap-4">
                <details className="rounded-xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Registrar consentimento ou revogação</summary>
                  <div className="mt-4">
                    <ConsentForm slug={org} contactId={contact.id} />
                  </div>
                </details>
                <details className="rounded-xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Descadastrar (lista de supressão)</summary>
                  <div className="mt-4">
                    <SuppressForm slug={org} contactId={contact.id} />
                  </div>
                </details>
              </div>
            )}
          </Panel>
        )}

        <Panel title="Histórico">
          {canWrite && (
            <div className="mb-6">
              <ActivityForm slug={org} leadId={lead.id} contactId={contact?.id} />
            </div>
          )}
          {activities.length ? (
            <ol className="grid gap-3 text-sm">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-xl border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{ACTIVITY_LABELS[activity.kind]}</span> ·{" "}
                    {(activity.actor_id && names.get(activity.actor_id)) || (activity.actor_type === "user" ? "Usuário" : "Sistema")} · {formatDateTime(activity.created_at)}
                  </p>
                  {activity.body && <p className="mt-1 whitespace-pre-wrap">{activity.body}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Sem registros.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function LeadPage({ params }: PageProps<"/ai-sales/[org]/leads/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LeadContent params={params} />
    </Suspense>
  );
}
