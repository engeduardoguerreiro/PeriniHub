import type { Metadata } from "next";

import { AgentModelForm } from "@/components/admin/forms";
import { AGENT_LABELS, Empty, PageHeading } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agentes" };

const DESCRIPTIONS: Record<string, string> = {
  researcher: "Lê os feeds cadastrados. Hoje é determinístico (não chama IA); o modelo fica reservado para evoluções.",
  curator: "Deduplica e pontua a relevância em lote. Modelo econômico.",
  writer: "Redige a notícia em português a partir das fontes. Modelo de boa qualidade.",
  fact_checker: "Extrai afirmações e aponta evidências literais, conferidas por código. Modelo de boa qualidade.",
  seo_editor: "Gera metadados, slug e links internos. Modelo econômico.",
};

export default async function AgentsPage() {
  const user = await requireEditor();
  const db = await createSessionClient();
  const { data: models } = await db.from("news_agent_models").select("*").order("agent_name");
  const order = ["researcher", "curator", "writer", "fact_checker", "seo_editor"];
  const sorted = [...(models ?? [])].sort((a, b) => order.indexOf(a.agent_name) - order.indexOf(b.agent_name));

  return (
    <>
      <PageHeading
        title="Agentes e modelos"
        description="Modelo de IA por função. Os preços servem para estimar e reservar o custo antes de cada chamada; mantenha-os iguais aos da tabela do provedor."
      />
      {sorted.length === 0 ? (
        <Empty>Nenhum agente configurado.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((model) => (
            <AgentModelForm
              key={model.agent_name}
              model={{ ...model, input_price_per_mtok: Number(model.input_price_per_mtok), output_price_per_mtok: Number(model.output_price_per_mtok) }}
              label={AGENT_LABELS[model.agent_name] ?? model.agent_name}
              description={DESCRIPTIONS[model.agent_name] ?? ""}
              readOnly={user.role !== "admin"}
            />
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-ink-900/60">
        O Publisher não usa IA: ele chama a função de publicação do banco, que valida aprovação, verificação e limite diário.
      </p>
    </>
  );
}
