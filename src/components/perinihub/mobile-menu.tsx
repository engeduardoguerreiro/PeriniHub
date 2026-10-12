"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Brand } from "@/components/perinihub/brand";
import { navItems } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Menu mobile com <dialog> nativo: o navegador cuida do foco preso, do Esc e
 * do fundo inerte, sem precisar de biblioteca de diálogo no bundle.
 */
export function MobileMenu({ onDark }: { onDark: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:hidden",
          onDark
            ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
            : "border-ink-900/15 bg-white text-ink-900 hover:bg-brand-50",
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menu PeriniHub"
        // Clique no backdrop (fora do painel) fecha o menu.
        onClick={(event) => event.target === event.currentTarget && close()}
        className="mobile-menu fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-950/60"
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between">
            <Brand />
            <button
              type="button"
              onClick={close}
              aria-label="Fechar menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-900/70 hover:bg-brand-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav className="mt-6 grid gap-1" aria-label="Navegação mobile">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-semibold text-ink-900/80 transition-colors hover:bg-brand-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/#contato"
            onClick={close}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Solicitar orçamento
          </Link>
        </div>
      </dialog>
    </>
  );
}
