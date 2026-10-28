import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { buttonClass } from "@/components/ai-sales/button-styles";
import { DataTable, FilterBar, Pagination, SearchInput } from "@/components/ai-sales/crm-ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, PageHeading } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { listCompanies, pageNumber, searchTerm } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Empresas" };

function formatCnpj(document: string | null) {
  return document ? document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—";
}

async function CompaniesContent({ params, searchParams }: PageProps<"/ai-sales/[org]/companies">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const q = searchTerm(query.q);
  const page = pageNumber(query.pagina);
  const { companies, total } = await listCompanies(membership.tenantId, q, page);
  const base = orgPath(org, "companies");
  return (
    <>
      <PageHeading
        title="Empresas"
        description="Empresas clientes e prospects (B2B)."
        actions={
          roleAtLeast(membership.role, "sales") && (
            <Link href={`${base}/nova`} className={buttonClass("primary")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nova empresa
            </Link>
          )
        }
      />
      <FilterBar action={base}>
        <SearchInput value={q} placeholder="Nome ou CNPJ" />
      </FilterBar>
      <DataTable head={["Empresa", "CNPJ", "Cidade", "Contatos"]} empty={!companies.length && <div className="p-4"><Empty>Nenhuma empresa encontrada.</Empty></div>}>
        {companies.map((company) => (
          <tr key={company.id} className="hover:bg-muted/50">
            <td className="px-4 py-3">
              <Link href={`${base}/${company.id}`} className="font-medium hover:text-primary hover:underline">
                {company.name}
              </Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{formatCnpj(company.document)}</td>
            <td className="px-4 py-3 text-muted-foreground">{[company.city, company.state].filter(Boolean).join(" / ") || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{company.contacts[0]?.count ?? 0}</td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} total={total} basePath={base} params={{ q }} />
    </>
  );
}

export default function CompaniesPage(props: PageProps<"/ai-sales/[org]/companies">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CompaniesContent {...props} />
    </Suspense>
  );
}
