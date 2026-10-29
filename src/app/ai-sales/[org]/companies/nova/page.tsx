import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CompanyForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { PageHeading, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Nova empresa" };

async function NewCompanyContent({ params }: Pick<PageProps<"/ai-sales/[org]/companies/nova">, "params">) {
  const { org } = await params;
  await requireMember(org, "sales");
  return (
    <>
      <Link href={orgPath(org, "companies")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Empresas
      </Link>
      <PageHeading title="Nova empresa" />
      <Panel title="Dados da empresa">
        <CompanyForm slug={org} />
      </Panel>
    </>
  );
}

export default function NewCompanyPage({ params }: PageProps<"/ai-sales/[org]/companies/nova">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewCompanyContent params={params} />
    </Suspense>
  );
}
