import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { ContactPermission } from "@/components/ai-sales/crm-ui";
import { AutoRefresh, Composer } from "@/components/ai-sales/inbox";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { formatDateTime, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { actorNames, suppressionsFor } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";
import { inServiceWindow, templateBody } from "@/features/ai-sales/whatsapp/templates";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";
import { cn } from "@/lib/utils";

import { assignConversation, setConversationStatus } from "../../whatsapp-actions";

export const metadata: Metadata = { title: "Conversa" };

const STATUS_LABEL: Record<string, string> = { received: "", queued: "na fila", sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" };
const SENDER_LABEL: Record<string, string> = { contact: "", user: "Equipe", agent: "Agente IA", system: "Sistema", business_app: "Celular (app)" };

async function ConversationContent({ params }: Pick<PageProps<"/ai-sales/[org]/inbox/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org, "sales");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createSalesSessionClient();
  const { data: conversation } = await db
    .from("conversations")
    .select("id, status, assigned_user_id, last_inbound_at, phone_number_id, contact:contacts(id, full_name, phone_e164, email_normalized), number:whatsapp_phone_numbers(account_id, status, display_phone, account:whatsapp_accounts(provider))")
    .eq("tenant_id", membership.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!conversation?.contact) notFound();
  const contact = conversation.contact;

  const [{ data: messages }, { data: templates }, { data: consents }, suppressions, { data: lead }] = await Promise.all([
    db.from("messages").select("id, direction, sender_type, sender_user_id, type, body, template_name, status, occurred_at, error").eq("tenant_id", membership.tenantId).eq("conversation_id", id).order("occurred_at").limit(300),
    db.from("whatsapp_templates").select("id, name, category, status, components").eq("tenant_id", membership.tenantId).eq("account_id", conversation.number?.account_id ?? "").eq("status", "APPROVED"),
    db.from("current_consents").select("channel, is_valid").eq("tenant_id", membership.tenantId).eq("contact_id", contact.id),
    suppressionsFor(membership.tenantId, contact.phone_e164, contact.email_normalized),
    db.from("leads").select("id").eq("tenant_id", membership.tenantId).eq("contact_id", contact.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const names = await actorNames([...(messages ?? []).map((message) => message.sender_user_id), conversation.assigned_user_id]);
  // Página dinâmica: comparar com o relógio aqui é seguro.
  const inWindow = inServiceWindow(conversation.last_inbound_at, Number(new Date()));
  const numberActive = conversation.number?.status === "active";
  const mine = conversation.assigned_user_id === membership.user.id;

  return (
    <>
      <AutoRefresh seconds={8} slug={org} conversationId={id} />
      <Link href={orgPath(org, "inbox")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Inbox
      </Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <section aria-label="Mensagens" className="grid content-start gap-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{contact.full_name}</h1>
          <ol className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-4">
            {(messages ?? []).map((message) => {
              const outbound = message.direction === "outbound";
              const system = message.sender_type === "system";
              return (
                <li key={message.id} className={cn("flex", system ? "justify-center" : outbound ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      system ? "bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100" : outbound ? "bg-primary text-primary-foreground" : "bg-card border border-border",
                    )}
                  >
                    {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : <p className="italic opacity-80">{message.template_name ? `Template ${message.template_name}` : `[${message.type}]`}</p>}
                    <p className={cn("mt-1 text-[11px]", outbound && !system ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {[SENDER_LABEL[message.sender_type] && (message.sender_user_id ? names.get(message.sender_user_id) : SENDER_LABEL[message.sender_type]), formatDateTime(message.occurred_at), outbound && STATUS_LABEL[message.status]]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              );
            })}
            {!messages?.length && <li className="text-center text-sm text-muted-foreground">Sem mensagens.</li>}
          </ol>
          <Panel title="Responder">
            <Composer
              slug={org}
              conversationId={id}
              inWindow={inWindow}
              unofficial={conversation.number?.account?.provider === "evolution"}
              disabledReason={!numberActive ? "Número desconectado: não é possível enviar por esta conversa." : conversation.status === "closed" ? "Conversa encerrada. Reabra para responder." : undefined}
              templates={(templates ?? []).map((template) => ({ id: template.id, name: template.name, category: template.category, body: templateBody(template.components) }))}
            />
          </Panel>
        </section>

        <aside className="grid content-start gap-4">
          <Panel title="Contato">
            <div className="grid gap-2 text-sm">
              <p>{formatPhone(contact.phone_e164)}</p>
              <ContactPermission authorized={(consents ?? []).some((consent) => consent.channel === "whatsapp" && consent.is_valid)} suppressed={suppressions.some((item) => item.channel === "whatsapp")} />
              <p className={inWindow ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                {inWindow ? "Janela de 24 h aberta: resposta livre permitida." : "Janela fechada: só template aprovado, com consentimento."}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href={orgPath(org, `contacts/${contact.id}`)} className="font-medium text-primary hover:underline">
                  Ver contato
                </Link>
                {lead && (
                  <Link href={orgPath(org, `leads/${lead.id}`)} className="font-medium text-primary hover:underline">
                    Ver lead
                  </Link>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Atendimento">
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">Responsável: {conversation.assigned_user_id ? names.get(conversation.assigned_user_id) ?? "membro" : "ninguém"}</p>
              <div className="flex flex-wrap gap-2">
                {!mine && <ActionButton action={assignConversation.bind(null, org, id, membership.user.id)}>Assumir</ActionButton>}
                {conversation.assigned_user_id && roleAtLeast(membership.role, "manager") && <ActionButton action={assignConversation.bind(null, org, id, null)}>Liberar</ActionButton>}
                {conversation.status === "closed" ? (
                  <ActionButton action={setConversationStatus.bind(null, org, id, "open")}>Reabrir</ActionButton>
                ) : (
                  <ActionButton action={setConversationStatus.bind(null, org, id, "closed")}>Encerrar</ActionButton>
                )}
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export default function ConversationPage({ params }: PageProps<"/ai-sales/[org]/inbox/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ConversationContent params={params} />
    </Suspense>
  );
}
