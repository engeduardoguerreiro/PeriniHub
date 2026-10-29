import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { CompanyForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { formatCnpj, isValidCnpj } from "@/features/ai-sales/capture/cnpj";
import { listCompanyEnrichments } from "@/features/ai-sales/capture/queries";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { getCompany } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

import { enrichCompany } from "../../capture-actions";

export const metadata: Metadata = { title: "Empresa" };

const SOURCE_LABELS: Record<string, string> = {
  brasilapi_cnpj: "Receita Federal (BrasilAPI)",
  form: "Formulário",
  manual: "Cadastro manual",
  import: "Importação CSV",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  document: "CNPJ",
  trade_name: "Nome fantasia",
  cnae: "CNAE",
  city: "Município",
  state: "UF",
  size: "Porte",
  opened_on: "Abertura",
  registration_status: "Situação cadastral",
};

type Provenance = Record<string, { source?: string; at?: string; origin?: string }>;

async function CompanyContent({ params }: Pick<PageProps<"/ai-sales/[org]/companies/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getCompany(membership.tenantId, id);
  if (!detail) notFound();
  const { company, contacts, leads } = detail;
  const enrichments = await listCompanyEnrichments(membership.tenantId, company.id);
  const latestEnrichment = enrichments[0];
  const canEdit = roleAtLeast(membership.role, "sales");
  const provenance = Object.entries((company.provenance ?? {}) as Provenance).filter(([, value]) => value && typeof value === "object");
  const publicData = [
    ["CNPJ", company.document ? formatCnpj(company.document) : null],
    ["Nome fantasia", company.trade_name],
    ["CNAE", company.cnae],
    ["Situação cadastral", company.registration_status],
    ["Porte", company.size],
    ["Abertura", company.opened_on ? new Date(`${company.opened_on}T12:00:00`).toLocaleDateString("pt-BR") : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));
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
            readOnly={!canEdit}
            values={{ name: company.name, document: company.document, city: company.city, state: company.state, website: company.website, notes: company.notes }}
          />
        </Panel>
        <div className="grid content-start gap-6">
          <Panel
            title="Dados públicos"
            description={company.enriched_at ? `Consultado em ${formatDateTime(company.enriched_at)}.` : "Ainda não consultado."}
            actions={
              canEdit && company.document && isValidCnpj(company.document) ? (
                <ActionButton action={enrichCompany.bind(null, org, company.id)}>Consultar CNPJ</ActionButton>
              ) : undefined
            }
          >
            {publicData.length ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {publicData.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty>{company.document ? "Use “Consultar CNPJ” para preencher com a base pública." : "Cadastre o CNPJ para consultar a base pública."}</Empty>
            )}
            {latestEnrichment && latestEnrichment.status !== "success" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Última consulta ({formatDateTime(latestEnrichment.fetched_at)}): {latestEnrichment.status === "not_found" ? "CNPJ não encontrado" : "erro na consulta"}.
              </p>
            )}
          </Panel>
          <Panel title="Origem das informações" description="Proveniência registrada por campo.">
            {provenance.length ? (
              <ul className="grid gap-1 text-sm">
                {provenance.map(([field, value]) => (
                  <li key={field}>
                    <span className="font-medium">{FIELD_LABELS[field] ?? (field in SOURCE_LABELS ? "Cadastro" : field)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {SOURCE_LABELS[value.source ?? field] ?? value.source ?? field} · {formatDateTime(value.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Sem registro de origem.</Empty>
            )}
          </Panel>
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
