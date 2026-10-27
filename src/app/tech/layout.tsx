import type { Metadata } from "next";

import { Footer } from "@/components/perinihub/footer";
import { Header } from "@/components/perinihub/header";

export const metadata: Metadata = {
  alternates: {
    types: { "application/rss+xml": [{ url: "/tech/rss.xml", title: "PeriniHub Tech" }] },
  },
};

export default function TechLayout({ children }: LayoutProps<"/tech">) {
  return (
    <>
      <Header />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
