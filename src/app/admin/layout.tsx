import type { Metadata } from "next";

// Nada do painel vai para buscadores (reforçado pelo X-Robots-Tag e pelo robots.txt).
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel PeriniHub" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
