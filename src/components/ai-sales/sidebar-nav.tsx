"use client";

import {
  BarChart3,
  Bot,
  Building2,
  Contact,
  Gauge,
  Inbox,
  KanbanSquare,
  Library,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { path: string; label: string; icon: LucideIcon; phase?: number };

// Módulos das próximas fases aparecem desativados, com a fase prevista:
// a estrutura fica visível sem fingir que existe.
const NAV_ITEMS: NavItem[] = [
  { path: "dashboard", label: "Dashboard", icon: Gauge },
  { path: "leads", label: "Leads", icon: Users },
  { path: "contacts", label: "Contatos", icon: Contact },
  { path: "companies", label: "Empresas", icon: Building2 },
  { path: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { path: "inbox", label: "Inbox", icon: Inbox, phase: 3 },
  { path: "agents", label: "Agentes", icon: Bot, phase: 4 },
  { path: "knowledge", label: "Conhecimento", icon: Library, phase: 4 },
  { path: "campaigns", label: "Campanhas", icon: Megaphone, phase: 5 },
  { path: "analytics", label: "Analytics", icon: BarChart3, phase: 5 },
  { path: "settings", label: "Configurações", icon: Settings },
];

export function SidebarNav({ slug }: { slug: string }) {
  return <SidebarNavList slug={slug} pathname={usePathname()} />;
}

/** Sem pathname (fallback do Suspense) nenhum item fica destacado. */
export function SidebarNavList({ slug, pathname }: { slug: string; pathname?: string }) {
  return (
    <nav aria-label="Módulos" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV_ITEMS.map(({ path, label, icon: Icon, phase }) => {
        const href = `/ai-sales/${slug}/${path}`;
        const itemClass = "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium";
        if (phase) {
          return (
            <span key={path} aria-disabled="true" title={`Disponível na Fase ${phase}`} className={cn(itemClass, "cursor-not-allowed text-white/35")}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              <span className="ml-auto hidden rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider lg:inline">Fase {phase}</span>
            </span>
          );
        }
        const active = pathname?.startsWith(href) ?? false;
        return (
          <Link
            key={path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              itemClass,
              "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
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
