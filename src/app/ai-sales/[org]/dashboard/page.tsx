import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleDashed, MailPlus, Users } from "lucide-react";
import Link from "next/link";

import { Notice, PageHeading, Panel, StatCard } from "@/components/ai-sales/ui";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { can } from "@/features/ai-sales/auth/roles";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

export const metadata: Metadata = { title: "Dashboard" };

// Estado real dos módulos: sem indicadores inventados. Os números comerciais
// (ARCHITECTURE.md §7) aparecem quando os módulos que os geram existirem.
const MODULES = [
  { name: "CRM, pipeline e importação", phase: 2, status: "Em desenvolvimento" },
  { name: "WhatsApp oficial e inbox", phase: 3, status: "Não configurado" },
  { name: "Agentes de IA e base de conhecimento", phase: 4, status: "Não configurado" },
  { name: "Campanhas e follow-up", phase: 5, status: "Não configurado" },
  { name: "Captação e enriquecimento", phase: 6, status: "Não configurado" },
];

async function DashboardPageContent({ params }: Pick<PageProps<"/ai-sales/[org]/dashboard">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const manage = can(membership.role, "invites.manage");
  const db = await createSalesSessionClient();
  const [{ count: members }, { count: invites }] = await Promise.all([
    db.from("organization_members").select("user_id", { count: "exact", head: true }).eq("tenant_id", membership.tenantId).eq("status", "active"),
    manage
      ? db
          .from("organization_invites")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", membership.tenantId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ count: null }),
  ]);

  return (
    <>
      <PageHeading title={membership.name} description="Visão geral da empresa no AI Sales." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Membros ativos" value={members ?? "—"} icon={Users} />
        {manage && <StatCard label="Convites pendentes" value={invites ?? "—"} icon={MailPlus} />}
        <StatCard label="Leads" value="—" hint="O CRM chega na Fase 2." icon={CircleDashed} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Módulos" description="O que já funciona e o que depende das próximas fases ou de integrações.">
          <ul className="divide-y divide-border text-sm">
            {MODULES.map((module) => (
              <li key={module.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>{module.name}</span>
                <span className="text-xs text-muted-foreground">
                  Fase {module.phase} · {module.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Primeiros passos">
          {manage ? (
            <p className="text-sm text-muted-foreground">
              Convide a equipe em{" "}
              <Link href={`/ai-sales/${org}/settings/membros`} className="font-medium text-primary hover:underline">
                Configurações → Membros
              </Link>{" "}
              e revise os dados em{" "}
              <Link href={`/ai-sales/${org}/settings/empresa`} className="font-medium text-primary hover:underline">
                Empresa
              </Link>
              .
            </p>
          ) : (
            <Notice>Os módulos comerciais serão liberados nas próximas fases.</Notice>
          )}
        </Panel>
      </div>
    </>
  );
}

// Suspense próprio da página: na navegação entre telas o layout fica e só o
// conteúdo mostra o esqueleto enquanto a sessão e os dados carregam.
export default function DashboardPage({ params }: PageProps<"/ai-sales/[org]/dashboard">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <DashboardPageContent params={params} />
    </Suspense>
  );
}
