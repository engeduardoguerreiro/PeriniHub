import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { UserBox } from "@/components/ai-sales/user-box";
import { Brand } from "@/components/perinihub/brand";
import { getMemberships, requirePlatformAdmin } from "@/features/ai-sales/auth/dal";

async function Footer() {
  const user = await requirePlatformAdmin();
  const memberships = await getMemberships();
  return <UserBox email={user.email} badge="superadmin" switchHref={memberships.length ? "/ai-sales/selecionar-empresa" : undefined} />;
}

export default function PlatformLayout({ children }: LayoutProps<"/ai-sales/platform">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-ink-950 px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Brand tone="dark" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300 lg:mt-3">AI Sales · Plataforma</p>
        </div>
        <nav aria-label="Plataforma" className="mt-4 lg:mt-8 lg:flex-1">
          <Link href="/ai-sales/platform" className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Empresas
          </Link>
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <Suspense fallback={<div className="h-14 animate-pulse rounded bg-white/5" />}>
            <Footer />
          </Suspense>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" aria-busy="true" aria-label="Carregando" />}>{children}</Suspense>
      </main>
    </div>
  );
}
