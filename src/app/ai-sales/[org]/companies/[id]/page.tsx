import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CompanyForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { getCompany } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Empresa" };

async function CompanyContent({ params }: Pick<PageProps<"/ai-sales/[org]/companies/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getCompany(membership.tenantId, id);
  if (!detail) notFound();
  const { company, contacts, leads } = detail;
  return (
    <>
      <Link href={orgPath(org, "companies")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Empresas
      </Link>
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">{company.name}</h1>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel title="Dados">
          <CompanyForm
            slug={org}
            companyId={company.id}
            readOnly={!roleAtLeast(membership.role, "sales")}
            values={{ name: company.name, document: company.document, city: company.city, state: company.state, website: company.website, notes: company.notes }}
          />
        </Panel>
        <div className="grid content-start gap-6">
          <Panel title="Contatos">
            {contacts.length ? (
              <ul className="divide-y divide-border text-sm">
                {contacts.map((contact) => (
                  <li key={contact.id} className="py-2">
                    <Link href={orgPath(org, `contacts/${contact.id}`)} className="font-medium hover:text-primary hover:underline">
                      {contact.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{[contact.job_title, formatPhone(contact.phone_e164), contact.email].filter((value) => value && value !== "—").join(" · ")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum contato ligado.</Empty>
            )}
          </Panel>
          <Panel title="Leads">
            {leads.length ? (
              <ul className="divide-y divide-border text-sm">
                {leads.map((lead) => (
                  <li key={lead.id} className="py-2">
                    <Link href={orgPath(org, `leads/${lead.id}`)} className="font-medium hover:text-primary hover:underline">
                      {lead.contact?.full_name || lead.title || "Lead"}
                    </Link>
                    {lead.title && lead.contact?.full_name && <span className="text-muted-foreground"> · {lead.title}</span>}
                    <span className="text-muted-foreground"> · {formatDateTime(lead.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum lead.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function CompanyPage({ params }: PageProps<"/ai-sales/[org]/companies/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CompanyContent params={params} />
    </Suspense>
  );
}
