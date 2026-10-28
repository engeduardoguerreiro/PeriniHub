import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { SourceForm, StageList } from "@/components/ai-sales/pipeline-settings";
import { Empty, Notice, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";

import { deleteTag, setSourceActive } from "../../crm-actions";

export const metadata: Metadata = { title: "Pipeline e origens" };

async function PipelineSettingsContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/pipeline">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  if (!roleAtLeast(membership.role, "manager")) return <Notice>Só gestores, administradores e proprietários configuram o pipeline.</Notice>;
  const options = await loadCrmOptions(membership.tenantId);
  return (
    <div className="grid gap-6">
      <Panel title={`Etapas do pipeline ${options.pipeline?.name ?? ""}`} description="A ordem define o Kanban. Etapas marcadas como qualificado contam no indicador de leads qualificados.">
        <StageList slug={org} stages={options.stages} />
      </Panel>
      <Panel title="Origens de leads">
        <ul className="divide-y divide-border text-sm">
          {options.sources.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-2 py-2">
              <span className={source.active ? undefined : "text-muted-foreground line-through"}>{source.name}</span>
              <ActionButton action={setSourceActive.bind(null, org, source.id, !source.active)}>{source.active ? "Desativar" : "Ativar"}</ActionButton>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <SourceForm slug={org} />
        </div>
      </Panel>
      <Panel title="Tags" description="Criadas pela equipe ao marcar contatos ou pela importação.">
        {options.tags.length ? (
          <ul className="flex flex-wrap gap-2">
            {options.tags.map((tag) => (
              <li key={tag.id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-3 pr-1 text-sm">
                {tag.name}
                <ActionButton
                  action={deleteTag.bind(null, org, tag.id)}
                  confirm={{ title: `Excluir a tag ${tag.name}?`, description: "Ela sai de todos os contatos.", confirmLabel: "Excluir" }}
                >
                  ×
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma tag.</Empty>
        )}
      </Panel>
    </div>
  );
}

export default function PipelineSettingsPage({ params }: PageProps<"/ai-sales/[org]/settings/pipeline">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PipelineSettingsContent params={params} />
    </Suspense>
  );
}
