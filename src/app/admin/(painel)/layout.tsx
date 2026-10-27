import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/app/admin/login/actions";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { Brand } from "@/components/perinihub/brand";
import { requireEditor } from "@/lib/auth/admin";

async function CurrentUser() {
  const user = await requireEditor();
  return (
    <div className="grid gap-2 text-xs text-white/55">
      <p className="truncate" title={user.email ?? undefined}>
        {user.email}
        <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-aqua-300">
          {user.role}
        </span>
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sair
        </button>
      </form>
    </div>
  );
}

function ContentFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-ink-900/8" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-900/5" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-ink-900/5" />
    </div>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-ink-950 px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Brand tone="dark" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300 lg:mt-3">Tech · Painel</p>
        </div>
        <div className="mt-4 lg:mt-8 lg:flex-1">
          <Suspense fallback={<AdminNavList />}>
            <AdminNav />
          </Suspense>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-4 lg:block">
          <Link
            href="/tech"
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            Ver portal <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
          <Suspense fallback={<div className="h-10 animate-pulse rounded bg-white/5" />}>
            <CurrentUser />
          </Suspense>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 flex-1 bg-background px-4 py-8 sm:px-6 lg:px-10">
        <Suspense fallback={<ContentFallback />}>{children}</Suspense>
      </main>
    </div>
  );
}
