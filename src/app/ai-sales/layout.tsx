import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { THEME_ROOT_ID, themeScript } from "@/components/ai-sales/theme-script";
import { isAiSalesEnabled } from "@/lib/env";

// Área privada do produto: fora de buscadores (reforçado pelo X-Robots-Tag e
// pelo robots.txt). Com a flag desligada, nada aqui existe.
export const metadata: Metadata = {
  title: { default: "AI Sales", template: "%s | PeriniHub AI Sales" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AiSalesLayout({ children }: LayoutProps<"/ai-sales">) {
  if (!isAiSalesEnabled()) notFound();
  return (
    // O script aplica a classe .dark antes da pintura; o atributo muda no
    // cliente, por isso suppressHydrationWarning.
    <div id={THEME_ROOT_ID} className="flex flex-1 flex-col bg-background text-foreground" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
