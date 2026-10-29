import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CaptureFormEditor, ProspectByCnpjForm } from "@/components/ai-sales/capture";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, PageHeading, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { FORM_STATUS } from "@/features/ai-sales/capture/labels";
import { listCaptureForms } from "@/features/ai-sales/capture/queries";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Captação" };

async function CaptureContent({ params }: Pick<PageProps<"/ai-sales/[org]/capture">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const manager = roleAtLeast(membership.role, "manager");
  const [forms, crm] = await Promise.all([listCaptureForms(membership.tenantId), manager ? loadCrmOptions(membership.tenantId) : null]);
  return (
    <>
      <PageHeading
        title="Captação"
        description="Formulários públicos com autorização de contato registrada e prospecção de empresas por dados públicos. Telefone ou e-mail encontrado nunca vale como autorização."
      />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-6">
          <Panel title="Formulários">
            {!forms.length ? (
              <Empty>Nenhum formulário.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {forms.map((form) => (
                  <li key={form.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <Link href={orgPath(org, `capture/${form.id}`)} className="font-medium hover:text-primary hover:underline">
                        {form.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {form.submissions_count} envio(s) · autorização v{form.consent_version} · criado em {formatDateTime(form.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={FORM_STATUS[form.status].tone} label={FORM_STATUS[form.status].label} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {manager && crm && (
            <Panel title="Novo formulário" description="Começa como rascunho; publique na página do formulário para o link funcionar.">
              <CaptureFormEditor slug={org} sources={crm.sources.filter((source) => source.active)} />
            </Panel>
          )}
        </div>
        {roleAtLeast(membership.role, "sales") && (
          <Panel title="Prospectar por CNPJ" description="Cadastra a empresa com razão social, CNAE, município e situação cadastral. O contato e a autorização vêm depois, por um canal legítimo.">
            <ProspectByCnpjForm slug={org} />
          </Panel>
        )}
      </div>
    </>
  );
}

export default function CapturePage({ params }: PageProps<"/ai-sales/[org]/capture">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CaptureContent params={params} />
    </Suspense>
  );
}
