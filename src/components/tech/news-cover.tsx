import { BrainCircuit, Cloud, Code2, Database, Globe, Newspaper, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { createElement } from "react";

import { isAllowedCoverUrl } from "@/lib/news/schemas";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, LucideIcon> = {
  "inteligencia-artificial": BrainCircuit,
  "desenvolvimento-web": Globe,
  "linguagens-e-ferramentas": Code2,
  "cloud-e-infraestrutura": Cloud,
  dados: Database,
  seguranca: ShieldCheck,
};

// Variação de cor por categoria dentro da paleta da marca.
const categoryGlow: Record<string, string> = {
  "inteligencia-artificial": "from-brand-500/45 via-aqua-400/20",
  "desenvolvimento-web": "from-brand-400/45 via-brand-600/20",
  "linguagens-e-ferramentas": "from-aqua-400/35 via-brand-500/25",
  "cloud-e-infraestrutura": "from-brand-300/40 via-aqua-500/20",
  dados: "from-aqua-500/40 via-brand-700/25",
  seguranca: "from-brand-700/60 via-aqua-400/15",
};

/** Ícone da categoria (createElement evita criar componente dinâmico no render). */
export function CategoryIcon({ slug, className }: { slug?: string; className?: string }) {
  return createElement((slug && categoryIcons[slug]) || Newspaper, { className, "aria-hidden": true });
}

type NewsCoverProps = {
  categorySlug?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  className?: string;
  size?: "sm" | "lg";
  priority?: boolean;
};

/**
 * Capa do artigo. Sem imagem licenciada, desenha uma capa própria com a
 * identidade da marca (sem custo de geração e sem risco de direitos autorais).
 * A capa gerada é decorativa: o título do card já descreve o conteúdo.
 */
export function NewsCover({ categorySlug, imageUrl, imageAlt, className, size = "sm", priority }: NewsCoverProps) {
  if (imageUrl && isAllowedCoverUrl(imageUrl)) {
    return (
      <div className={cn("relative overflow-hidden bg-ink-900", className)}>
        <Image
          src={imageUrl}
          alt={imageAlt ?? ""}
          fill
          sizes={size === "lg" ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
          className="object-cover"
          preload={priority}
        />
      </div>
    );
  }

  const glow = (categorySlug && categoryGlow[categorySlug]) || "from-brand-500/40 via-aqua-400/15";

  return (
    <div className={cn("relative isolate overflow-hidden bg-ink-950", className)} aria-hidden="true">
      <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br to-transparent", glow)} />
      <div className="grid-lines-dark absolute inset-0 -z-10 opacity-80" />
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-aqua-300 backdrop-blur-sm",
          size === "lg" ? "bottom-6 right-6 h-16 w-16 sm:h-20 sm:w-20" : "bottom-4 right-4 h-11 w-11",
        )}
      >
        <CategoryIcon slug={categorySlug} className={size === "lg" ? "h-8 w-8 sm:h-10 sm:w-10" : "h-5 w-5"} />
      </span>
    </div>
  );
}
