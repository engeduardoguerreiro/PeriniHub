import type { Metadata, Viewport } from "next";
import { Geist, Outfit } from "next/font/google";

import { sharedOpenGraph } from "@/lib/metadata";
import { CONTACT_EMAIL, jsonLd, SITE_URL, WHATSAPP_DISPLAY } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Fonte de display geométrica e arredondada, próxima do lettering do logotipo.
const displayFont = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const SITE_TITLE = "PeriniHub | Criação de Sites e Desenvolvimento de Sistemas";
const SITE_DESCRIPTION =
  "Criação de sites, landing pages e desenvolvimento de sistemas web sob medida para empresas. Painéis, integrações e automações. Orçamento em até 24 horas.";

export const viewport: Viewport = {
  themeColor: "#040b1c",
};

// Só o que vale para todas as rotas. Canonical e og:url ficam em cada página,
// senão qualquer rota sem override (inclusive o 404) apontaria para a home.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | PeriniHub",
  },
  description: SITE_DESCRIPTION,
  // As imagens de compartilhamento vêm de src/app/opengraph-image.tsx,
  // gerado dinamicamente. Não declarar `images` aqui para não sobrescrevê-lo.
  openGraph: {
    ...sharedOpenGraph,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": `${SITE_URL}/#org`,
      name: "PeriniHub",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      logo: `${SITE_URL}/perinihub-logo.png`,
      image: `${SITE_URL}/perinihub-logo.png`,
      email: CONTACT_EMAIL,
      telephone: WHATSAPP_DISPLAY,
      areaServed: "BR",
      serviceType: [
        "Criação de sites",
        "Desenvolvimento de sistemas web",
        "Automação de processos",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "PeriniHub",
      url: SITE_URL,
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${displayFont.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
        />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900 focus:shadow-lg"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
