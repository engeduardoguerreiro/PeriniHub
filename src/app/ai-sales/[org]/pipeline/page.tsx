import type { Metadata } from "next";
import { Suspense } from "react";

import { FilterBar, SelectFilter } from "@/components/ai-sales/crm-ui";
import { KanbanBoard } from "@/components/ai-sales/kanban";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, PageHeading } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { loadBoard, loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Pipeline" };

async function PipelineContent({ params, searchParams }: PageProps<"/ai-sales/[org]/pipeline">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const ownerParam = typeof query.responsavel === "string" && /^[0-9a-f-]{36}$/.test(query.responsavel) ? query.responsavel : "";
  const options = await loadCrmOptions(membership.tenantId);
  if (!options.stages.length) return <Empty>Pipeline sem etapas. Configure em Configurações → Pipeline.</Empty>;
  const board = await loadBoard(membership.tenantId, options.stages.map((stage) => stage.id), ownerParam);
  const base = orgPath(org, "pipeline");

  return (
    <>
      <PageHeading title="Pipeline" description="Arraste os cartões entre etapas, ou use o seletor de etapa de cada cartão (teclado)." />
      <FilterBar action={base}>
        <SelectFilter name="responsavel" label="Responsável" value={ownerParam} options={options.people.map((person) => ({ value: person.id, label: person.name }))} />
      </FilterBar>
      <KanbanBoard
        slug={org}
        readOnly={!roleAtLeast(membership.role, "sales")}
        stages={options.stages.map((stage) => ({ id: stage.id, name: stage.name, color: stage.color, total: board[stage.id]?.total ?? 0 }))}
        cards={options.stages.flatMap((stage) =>
          (board[stage.id]?.leads ?? []).map((lead) => ({
            id: lead.id,
            stageId: stage.id,
            name: lead.contact?.full_name ?? lead.company?.name ?? "Lead",
            company: lead.company?.name ?? null,
            title: lead.title,
            qualification: lead.qualification,
            score: lead.score,
            owner: options.people.find((person) => person.id === lead.owner_user_id)?.name ?? null,
          })),
        )}
      />
    </>
  );
}

export default function PipelinePage(props: PageProps<"/ai-sales/[org]/pipeline">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PipelineContent {...props} />
    </Suspense>
  );
}
