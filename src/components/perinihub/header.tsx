"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Brand } from "@/components/perinihub/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItems } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // No topo, o header fica sobre o hero escuro; ao rolar, vira uma barra clara.
  const onDark = !scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-ink-900/8 bg-white/85 shadow-[0_1px_24px_rgb(8_24_56/0.06)] backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Brand tone={onDark ? "dark" : "light"} preload />
        <nav
          className={cn(
            "hidden items-center gap-1 text-sm font-medium lg:flex",
            onDark ? "text-white/75" : "text-ink-900/70",
          )}
          aria-label="Navegação principal"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                onDark ? "hover:bg-white/8 hover:text-white" : "hover:bg-brand-50 hover:text-ink-900",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block">
          <Button
            asChild
            className="group h-10 rounded-full bg-brand-500 px-5 text-white shadow-[0_8px_24px_rgb(22_119_255/0.35)] hover:bg-brand-600"
          >
            <Link href="/#contato">
              Solicitar orçamento
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "lg:hidden",
                  onDark && "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
                )}
                aria-label="Abrir menu"
              />
            }
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="w-80 border-ink-900/10 bg-white">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu PeriniHub</SheetTitle>
              <Brand />
            </SheetHeader>
            <nav className="mt-6 grid gap-1 px-4" aria-label="Navegação mobile">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-ink-900/80 transition-colors hover:bg-brand-50 hover:text-ink-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-4">
              <Button asChild className="mt-6 h-11 w-full rounded-full bg-brand-500 text-white hover:bg-brand-600">
                <Link href="/#contato" onClick={() => setOpen(false)}>
                  Solicitar orçamento
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
