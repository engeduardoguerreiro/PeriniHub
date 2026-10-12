"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Brand } from "@/components/perinihub/brand";
import { MobileMenu } from "@/components/perinihub/mobile-menu";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

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
        <Brand tone="adaptive" onDark={onDark} />
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
                "rounded-md px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
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
            className="group h-10 rounded-full bg-brand-600 px-5 text-white shadow-[0_8px_24px_rgb(22_119_255/0.35)] hover:bg-brand-700"
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
        <MobileMenu onDark={onDark} />
      </div>
    </header>
  );
}
