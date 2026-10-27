"use client";

import { Bot, FileText, Gauge, History, Rss, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const adminNavItems = [
  { href: "/admin/noticias", label: "Visão geral", icon: Gauge },
  { href: "/admin/noticias/artigos", label: "Artigos", icon: FileText },
  { href: "/admin/noticias/fontes", label: "Fontes", icon: Rss },
  { href: "/admin/noticias/agentes", label: "Agentes", icon: Bot },
  { href: "/admin/noticias/execucoes", label: "Execuções", icon: History },
  { href: "/admin/noticias/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminNav() {
  return <AdminNavList pathname={usePathname()} />;
}

/** Sem pathname (fallback do Suspense) nenhum item fica destacado. */
export function AdminNavList({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Painel" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {adminNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname ? (href === "/admin/noticias" ? pathname === href : pathname.startsWith(href)) : false;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
              active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
