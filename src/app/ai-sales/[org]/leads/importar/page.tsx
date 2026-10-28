import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ImportForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, PageHeading, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export const metadata: Metadata = { title: "Importar contatos" };

async function ImportContent({ params }: Pick<PageProps<"/ai-sales/[org]/leads/importar">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org, "manager");
  const db = await createSalesSessionClient();
  const [options, { data: history }] = await Promise.all([
    loadCrmOptions(membership.tenantId),
    db
      .from("imports")
      .select("id, file_name, declared_origin, total_rows, created_contacts, updated_contacts, created_leads, rejected_rows, consent_declared, created_at")
      .eq("tenant_id", membership.tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return (
    <>
      <Link href={orgPath(org, "leads")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Leads
      </Link>
      <PageHeading title="Importar contatos" description="Planilha CSV exportada do Excel, Google Sheets ou de outro CRM." />
      <div className="grid gap-6">
        <Notice>
          Colunas reconhecidas: <strong>nome</strong> (obrigatória), <strong>telefone</strong> ou <strong>e-mail</strong> (ao menos um), empresa, cnpj, cargo,
          cidade, uf, tags (separadas por |) e consentimento whatsapp (sim/não). Telefone ou e-mail repetido atualiza o contato existente sem apagar
          dados. Importe só contatos obtidos de forma legítima.
        </Notice>
        <Panel title="Arquivo">
          <ImportForm slug={org} sources={options.sources.filter((source) => source.active)} />
        </Panel>
        <Panel title="Últimas importações">
          {!history?.length ? (
            <Empty>Nenhuma importação.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((item) => (
                <li key={item.id} className="py-2.5">
                  <p className="font-medium">
                    {item.file_name} <span className="font-normal text-muted-foreground">· {formatDateTime(item.created_at)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.total_rows} linhas · {item.created_contacts} novos · {item.updated_contacts} atualizados · {item.created_leads} leads · {item.rejected_rows} rejeitadas
                    {item.consent_declared && " · consentimento declarado"} · origem: {item.declared_origin}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function ImportPage({ params }: PageProps<"/ai-sales/[org]/leads/importar">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ImportContent params={params} />
    </Suspense>
  );
}
