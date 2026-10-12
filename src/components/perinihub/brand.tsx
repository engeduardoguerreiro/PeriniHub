import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  /**
   * "light" para fundos claros, "dark" para fundos escuros. "adaptive" carrega
   * as duas variantes e alterna por `onDark`, sem piscar quando o header muda.
   */
  tone?: "light" | "dark" | "adaptive";
  onDark?: boolean;
  className?: string;
  preload?: boolean;
};

// Dimensões do arquivo do logotipo (1235 × 356).
const LOGO_WIDTH = 1235;
const LOGO_HEIGHT = 356;

function LogoImage({ variant, preload, className }: { variant: "light" | "dark"; preload: boolean; className?: string }) {
  return (
    <Image
      src={variant === "dark" ? "/perinihub-logo-dark.png" : "/perinihub-logo.png"}
      alt={variant === "dark" ? "PeriniHub" : ""}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      preload={preload}
      // Acima da dobra, mas não é o LCP (o h1 é): carrega cedo sem preload.
      loading="eager"
      sizes="140px"
      className={cn("h-9 w-auto sm:h-10", className)}
    />
  );
}

export function Brand({ tone = "light", onDark = true, className, preload = false }: BrandProps) {
  return (
    <Link
      href="/"
      aria-label="PeriniHub, voltar ao início"
      className={cn(
        "relative inline-flex shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500",
        className,
      )}
    >
      {tone === "adaptive" ? (
        <>
          <LogoImage
            variant="dark"
            preload={preload}
            className={cn("transition-opacity duration-300", !onDark && "opacity-0")}
          />
          <LogoImage
            variant="light"
            preload={preload}
            className={cn("absolute inset-0 transition-opacity duration-300", onDark && "opacity-0")}
          />
        </>
      ) : (
        <LogoImage variant={tone} preload={preload} />
      )}
    </Link>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/perinihub-mark.png"
      alt=""
      width={316}
      height={356}
      sizes="(max-width: 1024px) 96px, 160px"
      className={cn("h-auto w-full", className)}
    />
  );
}
