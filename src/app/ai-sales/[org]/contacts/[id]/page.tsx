import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { ContactPermission } from "@/components/ai-sales/crm-ui";
import { ActivityForm, ConsentForm, ContactForm, SuppressForm, TagEditor } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { ACTIVITY_LABELS, CHANNEL_LABELS, LEGAL_BASIS_LABELS, PURPOSE_LABELS, SUPPRESSION_LABELS } from "@/features/ai-sales/crm/labels";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { actorNames, getContact } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

import { deleteContact, removeSuppression } from "../../crm-actions";

export const metadata: Metadata = { title: "Contato" };

async function ContactContent({ params }: Pick<PageProps<"/ai-sales/[org]/contacts/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getContact(membership.tenantId, id);
  if (!detail) notFound();
  const { contact, leads, consentHistory, activities, suppressions } = detail;
  const canWrite = roleAtLeast(membership.role, "sales");
  const names = await actorNames([...activities.map((activity) => activity.actor_id)]);
  // Vigente = o registro mais recente de cada canal/finalidade.
  const latest = new Map<string, (typeof consentHistory)[number]>();
  for (const record of consentHistory) if (!latest.has(`${record.channel}:${record.purpose}`)) latest.set(`${record.channel}:${record.purpose}`, record);
  const authorized = [...latest.values()].some((record) => record.channel === "whatsapp" && record.status === "granted");
  const suppressed = suppressions.some((item) => item.channel === "whatsapp");

  return (
    <>
      <Link href={orgPath(org, "contacts")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Contatos
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <ContactPermission authorized={authorized} suppressed={suppressed} />
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{contact.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[formatPhone(contact.phone_e164), contact.email, contact.company?.name].filter((value) => value && value !== "—").join(" · ")}
          </p>
        </div>
        {roleAtLeast(membership.role, "manager") && (
          <ActionButton
            variant="danger"
            action={deleteContact.bind(null, org, contact.id)}
            confirm={{ title: "Excluir contato?", description: "O contato e os leads ligados a ele saem das listas. A exclusão é auditada; a lista de supressão continua valendo.", confirmLabel: "Excluir" }}
          >
            Excluir
          </ActionButton>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-6">
          <Panel title="Dados do contato">
            <ContactForm
              slug={org}
              contactId={contact.id}
              readOnly={!canWrite}
              values={{ full_name: contact.full_name, phone: contact.phone_e164 ?? "", email: contact.email, job_title: contact.job_title, city: contact.city, state: contact.state, notes: contact.notes }}
            />
          </Panel>
          <Panel title="Tags">
            <TagEditor slug={org} contactId={contact.id} readOnly={!canWrite} tags={contact.contact_tags.map((item) => item.tags?.name).filter((name): name is string => Boolean(name))} />
          </Panel>
          <Panel title="Histórico">
            {canWrite && (
              <div className="mb-6">
                <ActivityForm slug={org} contactId={contact.id} />
              </div>
            )}
            {activities.length ? (
              <ol className="grid gap-3 text-sm">
                {activities.map((activity) => (
                  <li key={activity.id} className="rounded-xl border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{ACTIVITY_LABELS[activity.kind]}</span> · {(activity.actor_id && names.get(activity.actor_id)) || "Sistema"} ·{" "}
                      {formatDateTime(activity.created_at)}
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

        <div className="grid content-start gap-6">
          <Panel title="Leads">
            {leads.length ? (
              <ul className="divide-y divide-border text-sm">
                {leads.map((lead) => (
                  <li key={lead.id} className="py-2">
                    <Link href={orgPath(org, `leads/${lead.id}`)} className="font-medium hover:text-primary hover:underline">
                      {lead.title || "Lead"}
                    </Link>
                    <span className="text-muted-foreground"> · {formatDateTime(lead.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum lead.</Empty>
            )}
          </Panel>
          <Panel title="Consentimentos" description="Histórico completo, do mais recente ao mais antigo.">
            {suppressions.length > 0 && (
              <ul className="mb-4 grid gap-2 text-sm">
                {suppressions.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-red-700 dark:text-red-300">
                    <span>
                      Supressão {CHANNEL_LABELS[item.channel]}: {SUPPRESSION_LABELS[item.reason]}
                    </span>
                    {roleAtLeast(membership.role, "admin") && (
                      <ActionButton
                        action={removeSuppression.bind(null, org, item.id)}
                        confirm={{ title: "Remover da supressão?", description: "Use só com pedido explícito do titular. Não recria consentimento; fica na auditoria.", confirmLabel: "Remover", reason: true }}
                      >
                        Remover
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {consentHistory.length ? (
              <ol className="mb-4 grid gap-2 text-sm">
                {consentHistory.map((record) => (
                  <li key={record.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="font-medium">
                      {record.status === "granted" ? "Autorizou" : "Revogou"} · {CHANNEL_LABELS[record.channel]} · {PURPOSE_LABELS[record.purpose]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {LEGAL_BASIS_LABELS[record.legal_basis]} · {record.source} · {formatDateTime(record.recorded_at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mb-4">
                <Empty>Nenhum consentimento registrado.</Empty>
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
                  <summary className="cursor-pointer text-sm font-semibold">Descadastrar</summary>
                  <div className="mt-4">
                    <SuppressForm slug={org} contactId={contact.id} />
                  </div>
                </details>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function ContactPage({ params }: PageProps<"/ai-sales/[org]/contacts/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ContactContent params={params} />
    </Suspense>
  );
}
