import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, FilterBar, Pagination, SearchInput } from "@/components/ai-sales/crm-ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, PageHeading } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { formatPhone } from "@/features/ai-sales/crm/phone";
import { listContacts, pageNumber, searchTerm } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Contatos" };

async function ContactsContent({ params, searchParams }: PageProps<"/ai-sales/[org]/contacts">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const query = await searchParams;
  const q = searchTerm(query.q);
  const page = pageNumber(query.pagina);
  const { contacts, total } = await listContacts(membership.tenantId, q, page);
  const base = orgPath(org, "contacts");
  return (
    <>
      <PageHeading title="Contatos" description="Pessoas cadastradas. Novos contatos entram pelo cadastro de lead ou pela importação." />
      <FilterBar action={base}>
        <SearchInput value={q} placeholder="Nome, telefone ou e-mail" />
      </FilterBar>
      <DataTable head={["Nome", "Telefone", "E-mail", "Empresa", "Tags"]} empty={!contacts.length && <div className="p-4"><Empty>Nenhum contato encontrado.</Empty></div>}>
        {contacts.map((contact) => (
          <tr key={contact.id} className="hover:bg-muted/50">
            <td className="px-4 py-3">
              <Link href={`${base}/${contact.id}`} className="font-medium hover:text-primary hover:underline">
                {contact.full_name}
              </Link>
              {contact.job_title && <p className="text-xs text-muted-foreground">{contact.job_title}</p>}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{formatPhone(contact.phone_e164)}</td>
            <td className="px-4 py-3 text-muted-foreground">{contact.email ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{contact.company?.name ?? "—"}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {contact.contact_tags.map((item) =>
                  item.tags ? (
                    <span key={item.tags.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {item.tags.name}
                    </span>
                  ) : null,
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} total={total} basePath={base} params={{ q }} />
    </>
  );
}

export default function ContactsPage(props: PageProps<"/ai-sales/[org]/contacts">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ContactsContent {...props} />
    </Suspense>
  );
}
