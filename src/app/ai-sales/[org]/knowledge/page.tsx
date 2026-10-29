import type { Metadata } from "next";
import { Suspense } from "react";

import { KnowledgeBaseForm, KnowledgeDocumentForm, KnowledgeSearch } from "@/components/ai-sales/agents";
import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, PageHeading, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { deleteKnowledgeDocument } from "../agents-actions";

export const metadata: Metadata = { title: "Conhecimento" };

async function KnowledgeContent({ params }: Pick<PageProps<"/ai-sales/[org]/knowledge">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org, "sales");
  const db = await createSalesSessionClient();
  const [{ data: bases }, { data: documents }] = await Promise.all([
    db.from("knowledge_bases").select("id, name, description").eq("tenant_id", membership.tenantId).order("name"),
    db.from("knowledge_documents").select("id, knowledge_base_id, title, chunk_count, created_at").eq("tenant_id", membership.tenantId).order("created_at", { ascending: false }),
  ]);
  const manage = roleAtLeast(membership.role, "manager");
  return (
    <>
      <PageHeading title="Base de conhecimento" description="O que os agentes podem afirmar: produtos, preços, prazos, perguntas frequentes e políticas. Fora daqui, o agente transfere para um humano." />
      <div className="grid gap-6">
        {!manage && <Notice>Só gestores e administradores alteram a base.</Notice>}
        {manage && (
          <Panel title="Bases">
            <KnowledgeBaseForm slug={org} />
          </Panel>
        )}
        {manage && (bases?.length ?? 0) > 0 && (
          <Panel title="Adicionar documento">
            <KnowledgeDocumentForm slug={org} bases={bases ?? []} />
          </Panel>
        )}
        {(bases ?? []).map((base) => (
          <Panel key={base.id} title={base.name} description={base.description ?? undefined}>
            {(documents ?? []).filter((document) => document.knowledge_base_id === base.id).length ? (
              <ul className="divide-y divide-border text-sm">
                {(documents ?? [])
                  .filter((document) => document.knowledge_base_id === base.id)
                  .map((document) => (
                    <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {document.title} <span className="text-muted-foreground">· {document.chunk_count} trecho(s) · {formatDateTime(document.created_at)}</span>
                      </span>
                      {manage && (
                        <ActionButton
                          variant="danger"
                          action={deleteKnowledgeDocument.bind(null, org, document.id)}
                          confirm={{ title: "Remover documento?", description: "Os agentes deixam de usar este conteúdo imediatamente.", confirmLabel: "Remover" }}
                        >
                          Remover
                        </ActionButton>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <Empty>Sem documentos nesta base.</Empty>
            )}
          </Panel>
        ))}
        {!bases?.length && <Empty>Nenhuma base criada.</Empty>}
        <Panel title="Testar busca" description="Veja quais trechos o agente encontraria para uma pergunta de cliente.">
          <KnowledgeSearch slug={org} />
        </Panel>
      </div>
    </>
  );
}

export default function KnowledgePage({ params }: PageProps<"/ai-sales/[org]/knowledge">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <KnowledgeContent params={params} />
    </Suspense>
  );
}
