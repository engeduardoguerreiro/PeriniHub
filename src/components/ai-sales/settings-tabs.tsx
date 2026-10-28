"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { path: "membros", label: "Membros" },
  { path: "empresa", label: "Empresa" },
  { path: "auditoria", label: "Auditoria" },
] as const;

export function SettingsTabs({ slug }: { slug: string }) {
  return <SettingsTabsList slug={slug} pathname={usePathname()} />;
}

export function SettingsTabsList({ slug, pathname }: { slug: string; pathname?: string }) {
  return (
    <nav aria-label="Seções de configuração" className="mb-6 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {TABS.map(({ path, label }) => {
        const href = `/ai-sales/${slug}/settings/${path}`;
        const active = pathname === href;
        return (
          <Link
            key={path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
