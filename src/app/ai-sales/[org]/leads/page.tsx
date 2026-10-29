import type { Metadata } from "next";
import { Download, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { buttonClass } from "@/components/ai-sales/button-styles";
import { DataTable, FilterBar, Pagination, SearchInput, SelectFilter, StageBadge } from "@/components/ai-sales/crm-ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, PageHeading } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { QUALIFICATION_LABELS } from "@/features/ai-sales/crm/labels";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { listLeads, loadCrmOptions, pageNumber, searchTerm } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Leads" };

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
const uuidOrEmpty = (value: string) => (/^[0-9a-f-]{36}$/.test(value) ? value : "");

async function LeadsContent({ params, searchParams }: PageProps<"/ai-sales/[org]/leads">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const filters = {
    q: searchTerm(query.q),
    stage: uuidOrEmpty(pick(query.etapa)),
    source: uuidOrEmpty(pick(query.origem)),
    owner: pick(query.responsavel) === "none" ? "none" : uuidOrEmpty(pick(query.responsavel)),
    qualification: pick(query.interesse) in QUALIFICATION_LABELS ? pick(query.interesse) : "",
    page: pageNumber(query.pagina),
  };
  const [options, { leads, total }] = await Promise.all([loadCrmOptions(membership.tenantId), listLeads(membership.tenantId, filters)]);
  const stageById = new Map(options.stages.map((stage) => [stage.id, stage]));
  const personById = new Map(options.people.map((person) => [person.id, person.name]));
  const sourceById = new Map(options.sources.map((source) => [source.id, source.name]));
  const canWrite = roleAtLeast(membership.role, "sales");
  const canManage = roleAtLeast(membership.role, "manager");
  const base = orgPath(org, "leads");
  const exportParams = new URLSearchParams(Object.entries({ q: filters.q, etapa: filters.stage, origem: filters.source, responsavel: filters.owner, interesse: filters.qualification }).filter(([, value]) => value));

  return (
    <>
      <PageHeading
        title="Leads"
        description="Oportunidades em prospecção. A autorização de contato fica no cadastro do contato, separada da etapa."
        actions={
          <>
            {canManage && (
              <>
                <Link href={`${base}/exportar?${exportParams.toString()}`} className={buttonClass("secondary")} prefetch={false}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
                </Link>
                <Link href={`${base}/importar`} className={buttonClass("secondary")}>
                  <Upload className="h-4 w-4" aria-hidden="true" /> Importar
                </Link>
              </>
            )}
            {canWrite && (
              <Link href={`${base}/novo`} className={buttonClass("primary")}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Novo lead
              </Link>
            )}
          </>
        }
      />
      <FilterBar action={base}>
        <SearchInput value={filters.q} placeholder="Nome, telefone ou e-mail" />
        <SelectFilter name="etapa" label="Etapa" value={filters.stage} options={options.stages.map((stage) => ({ value: stage.id, label: stage.name }))} />
        <SelectFilter name="origem" label="Origem" value={filters.source} options={options.sources.map((source) => ({ value: source.id, label: source.name }))} />
        <SelectFilter
          name="responsavel"
          label="Responsável"
          value={filters.owner}
          options={[{ value: "none", label: "Sem responsável" }, ...options.people.map((person) => ({ value: person.id, label: person.name }))]}
        />
        <SelectFilter name="interesse" label="Interesse" value={filters.qualification} options={Object.entries(QUALIFICATION_LABELS).map(([value, label]) => ({ value, label }))} />
      </FilterBar>

      <DataTable
        head={["Contato", "Etapa", "Interesse", "Responsável", "Origem", "Criado em"]}
        empty={!leads.length && <div className="p-4"><Empty>{filters.q || filters.stage ? "Nenhum lead com esses filtros." : "Nenhum lead ainda. Crie o primeiro ou importe uma planilha."}</Empty></div>}
      >
        {leads.map((lead) => {
          const stage = stageById.get(lead.stage_id);
          return (
            <tr key={lead.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <Link href={`${base}/${lead.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                  {lead.contact?.full_name ?? lead.company?.name ?? "Lead"}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[lead.company?.name, lead.contact?.phone_e164 ? formatPhone(lead.contact.phone_e164) : lead.contact?.email].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="px-4 py-3">{stage && <StageBadge name={stage.name} color={stage.color} />}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {QUALIFICATION_LABELS[lead.qualification]}
                {lead.score != null && ` · ${lead.score}`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{(lead.owner_user_id && personById.get(lead.owner_user_id)) || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{(lead.lead_source_id && sourceById.get(lead.lead_source_id)) || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDateTime(lead.created_at)}</td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={filters.page} total={total} basePath={base} params={{ q: filters.q, etapa: filters.stage, origem: filters.source, responsavel: filters.owner, interesse: filters.qualification }} />
    </>
  );
}

export default function LeadsPage(props: PageProps<"/ai-sales/[org]/leads">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LeadsContent {...props} />
    </Suspense>
  );
}
