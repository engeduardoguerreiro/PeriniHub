import { ArrowLeftRight, LogOut } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/ai-sales/login/actions";

import { ThemeToggle } from "./theme";

/** Rodapé da barra lateral: usuário, troca de empresa, tema e sair. */
export function UserBox({ email, badge, switchHref }: { email: string | null; badge?: string; switchHref?: string }) {
  return (
    <div className="grid min-w-0 gap-3 text-xs text-white/60">
      <p className="truncate" title={email ?? undefined}>
        {email}
        {badge && <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-aqua-300">{badge}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ThemeToggle />
        {switchHref && (
          <Link href={switchHref} className="inline-flex items-center gap-1.5 rounded-md font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400">
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            Trocar
          </Link>
        )}
        <form action={signOut}>
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-md font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
