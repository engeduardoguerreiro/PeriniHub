import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Seção com entrada suave ao rolar, feita só com CSS (`.reveal` em globals.css).
 * O conteúdo fica visível mesmo sem JavaScript ou em navegadores sem
 * scroll-driven animations; a animação é um aprimoramento progressivo.
 */
export function AnimatedSection({ children, className, id }: AnimatedSectionProps) {
  return (
    <section id={id} className={cn("reveal", className)}>
      {children}
    </section>
  );
}
