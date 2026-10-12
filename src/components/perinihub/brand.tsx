import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  /** "light" para fundos claros; "dark" usa a variante com "Perini" em branco. */
  tone?: "light" | "dark";
  className?: string;
  preload?: boolean;
};

// Proporção do arquivo do logotipo (2470 × 712).
const LOGO_WIDTH = 2470;
const LOGO_HEIGHT = 712;

export function Brand({ tone = "light", className, preload = false }: BrandProps) {
  return (
    <Link
      href="/"
      aria-label="PeriniHub, voltar ao início"
      className={cn(
        "inline-flex shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4",
        tone === "dark" && "focus-visible:ring-offset-ink-900",
        className,
      )}
    >
      <Image
        src={tone === "dark" ? "/perinihub-logo-dark.png" : "/perinihub-logo.png"}
        alt="PeriniHub"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        preload={preload}
        sizes="160px"
        className="h-9 w-auto sm:h-10"
      />
    </Link>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/perinihub-mark.png"
      alt=""
      width={632}
      height={712}
      sizes="(max-width: 1024px) 96px, 160px"
      className={cn("h-auto w-full", className)}
    />
  );
}
