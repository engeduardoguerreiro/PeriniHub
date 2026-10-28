import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { NewLeadForm } from "@/components/ai-sales/crm-forms";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { PageHeading, Panel } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { orgPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Novo lead" };

async function NewLeadContent({ params }: Pick<PageProps<"/ai-sales/[org]/leads/novo">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org, "sales");
  const options = await loadCrmOptions(membership.tenantId);
  return (
    <>
      <Link href={orgPath(org, "leads")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Leads
      </Link>
      <PageHeading title="Novo lead" />
      <Panel title="Dados do lead">
        <NewLeadForm
          slug={org}
          stages={options.stages.filter((stage) => !stage.is_won && !stage.is_lost)}
          sources={options.sources.filter((source) => source.active)}
          people={options.people}
          defaultOwner={membership.role === "sales" ? membership.user.id : ""}
        />
      </Panel>
    </>
  );
}

export default function NewLeadPage({ params }: PageProps<"/ai-sales/[org]/leads/novo">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewLeadContent params={params} />
    </Suspense>
  );
}
