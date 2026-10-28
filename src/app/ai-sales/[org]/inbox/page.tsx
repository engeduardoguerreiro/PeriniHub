import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AutoRefresh, SimulatorForm } from "@/components/ai-sales/inbox";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, PageHeading, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { orgPath } from "@/features/ai-sales/paths";
import { inServiceWindow } from "@/features/ai-sales/whatsapp/templates";
import { whatsappMode } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox" };

const TABS = { abertas: "Abertas", minhas: "Minhas", "sem-responsavel": "Sem responsável", humano: "Aguardando humano", encerradas: "Encerradas" } as const;
type Tab = keyof typeof TABS;

async function InboxContent({ params, searchParams }: PageProps<"/ai-sales/[org]/inbox">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const tab: Tab = typeof query.aba === "string" && query.aba in TABS ? (query.aba as Tab) : "abertas";
  const db = await createSalesSessionClient();
  const { data: numbers } = await db.from("whatsapp_phone_numbers").select("id, account:whatsapp_accounts(provider)").eq("tenant_id", membership.tenantId).eq("status", "active");
  const canRead = roleAtLeast(membership.role, "sales");

  let list = db
    .from("conversations")
    .select("id, status, unread_count, last_message_at, last_message_preview, last_inbound_at, assigned_user_id, contact:contacts(full_name, phone_e164)")
    .eq("tenant_id", membership.tenantId)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (tab === "encerradas") list = list.eq("status", "closed");
  else list = list.neq("status", "closed");
  if (tab === "minhas") list = list.eq("assigned_user_id", membership.user.id);
  if (tab === "sem-responsavel") list = list.is("assigned_user_id", null);
  if (tab === "humano") list = list.eq("status", "pending_human");
  const { data: conversations } = await list;
  const sandbox = whatsappMode() === "mock" && (numbers ?? []).some((number) => number.account?.provider === "sandbox");
  const base = orgPath(org, "inbox");
  // Página dinâmica: comparar com o relógio aqui é seguro.
  const now = Number(new Date());

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeading title="Inbox" description="Conversas do WhatsApp da empresa. Atualiza sozinha a cada 10 segundos." />
      {!numbers?.length && (
        <div className="mb-6">
          <Notice tone="warning">
            WhatsApp não configurado.{" "}
            <Link href={orgPath(org, "settings/whatsapp")} className="font-semibold underline">
              Conectar em Configurações → WhatsApp
            </Link>
            .
          </Notice>
        </div>
      )}
      {sandbox && canRead && (
        <Panel title="Simulador (modo simulado)" className="mb-6" description="Gera uma mensagem recebida pelo mesmo caminho do webhook real. Envie “SAIR” para testar o descadastro.">
          <SimulatorForm slug={org} />
        </Panel>
      )}
      <nav aria-label="Filtros da inbox" className="mb-4 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {Object.entries(TABS).map(([value, label]) => (
          <Link
            key={value}
            href={`${base}?aba=${value}`}
            aria-current={tab === value ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2 text-sm font-medium", tab === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!canRead ? (
        <Notice>Seu papel não tem acesso ao conteúdo das conversas.</Notice>
      ) : !conversations?.length ? (
        <Empty>Nenhuma conversa nesta aba.</Empty>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {conversations.map((conversation) => {
            const open = inServiceWindow(conversation.last_inbound_at, now);
            return (
              <li key={conversation.id}>
                <Link href={`${base}/${conversation.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      {conversation.contact?.full_name ?? "Contato"}
                      {conversation.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{conversation.unread_count}</span>}
                      {conversation.status === "pending_human" && <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">humano</span>}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{conversation.last_message_preview ?? formatPhone(conversation.contact?.phone_e164)}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {formatDateTime(conversation.last_message_at)}
                    <span className={cn("mt-1 block", open ? "text-emerald-700 dark:text-emerald-300" : "")}>{open ? "janela aberta" : "janela fechada"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function InboxPage(props: PageProps<"/ai-sales/[org]/inbox">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <InboxContent {...props} />
    </Suspense>
  );
}
