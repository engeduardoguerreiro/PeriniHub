import { Suspense } from "react";

import { SidebarNav, SidebarNavList } from "@/components/ai-sales/sidebar-nav";
import { RoleBadge } from "@/components/ai-sales/ui";
import { UserBox } from "@/components/ai-sales/user-box";
import { Brand } from "@/components/perinihub/brand";
import { getMemberships, requireMember } from "@/features/ai-sales/auth/dal";

type Params = LayoutProps<"/ai-sales/[org]">["params"];

// Tudo que depende da sessão ou do slug fica em Suspense: o shell da barra
// lateral é estático e o conteúdo autenticado chega por streaming.

async function OrgHeader({ params }: { params: Params }) {
  const { org } = await params;
  const membership = await requireMember(org);
  return (
    <div className="min-w-0">
      <p className="truncate font-display text-sm font-semibold text-white" title={membership.name}>
        {membership.name}
      </p>
      <div className="mt-1">
        <RoleBadge role={membership.role} />
      </div>
    </div>
  );
}

async function Nav({ params }: { params: Params }) {
  const { org } = await params;
  await requireMember(org);
  return (
    <Suspense fallback={<SidebarNavList slug={org} />}>
      <SidebarNav slug={org} />
    </Suspense>
  );
}

async function Footer({ params }: { params: Params }) {
  const { org } = await params;
  const membership = await requireMember(org);
  const several = (await getMemberships()).length > 1;
  return <UserBox email={membership.user.email} switchHref={several ? "/ai-sales/selecionar-empresa" : undefined} />;
}

function ContentFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function OrgLayout({ children, params }: LayoutProps<"/ai-sales/[org]">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-ink-950 px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Brand tone="dark" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300 lg:mt-3">AI Sales</p>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 lg:mt-6">
          <Suspense fallback={<div className="h-10 animate-pulse rounded bg-white/5" />}>
            <OrgHeader params={params} />
          </Suspense>
        </div>
        <div className="mt-4 lg:flex-1 lg:overflow-y-auto">
          <Suspense fallback={<div className="h-64 animate-pulse rounded bg-white/5" />}>
            <Nav params={params} />
          </Suspense>
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <Suspense fallback={<div className="h-14 animate-pulse rounded bg-white/5" />}>
            <Footer params={params} />
          </Suspense>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <Suspense fallback={<ContentFallback />}>{children}</Suspense>
      </main>
    </div>
  );
}
