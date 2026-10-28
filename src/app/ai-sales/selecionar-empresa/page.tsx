import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard, FormFallback } from "@/components/ai-sales/auth-card";
import { RoleBadge, StatusBadge } from "@/components/ai-sales/ui";
import { getMemberships, isPlatformAdmin, requireSalesUser } from "@/features/ai-sales/auth/dal";
import { AI_SALES_PLATFORM, orgPath } from "@/features/ai-sales/paths";

import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Escolher empresa" };

async function OrgList() {
  const user = await requireSalesUser();
  const [memberships, platformAdmin] = await Promise.all([getMemberships(), isPlatformAdmin(user.id)]);
  return (
    <div className="grid gap-3">
      {memberships.length === 0 && <p className="text-sm text-muted-foreground">Sua conta ainda não participa de nenhuma empresa.</p>}
      <ul className="grid gap-2">
        {memberships.map((membership) => (
          <li key={membership.tenantId}>
            {membership.status === "active" ? (
              <Link
                href={orgPath(membership.slug)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{membership.name}</span>
                  <RoleBadge role={membership.role} />
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-muted-foreground">
                <span className="truncate">{membership.name}</span>
                <StatusBadge status={membership.status} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {platformAdmin && (
        <Link href={AI_SALES_PLATFORM} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Painel da plataforma
        </Link>
      )}
      <form action={signOut} className="mt-2">
        <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sair ({user.email})
        </button>
      </form>
    </div>
  );
}

export default function SelectOrgPage() {
  return (
    <AuthCard title="Escolha a empresa" description="Você participa de mais de uma empresa. Os dados de cada uma ficam separados.">
      <Suspense fallback={<FormFallback />}>
        <OrgList />
      </Suspense>
    </AuthCard>
  );
}
