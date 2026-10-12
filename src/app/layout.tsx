import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";

import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonte de display geométrica e arredondada, próxima do lettering do logotipo.
const displayFont = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const SITE_DESCRIPTION =
  "Criação de sites, landing pages e desenvolvimento de sistemas web sob medida para empresas. Painéis, integrações e automações. Orçamento em até 24 horas.";

export const viewport: Viewport = {
  themeColor: "#081838",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PeriniHub | Criação de Sites e Desenvolvimento de Sistemas",
    template: "%s | PeriniHub",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "criação de sites",
    "desenvolvimento de sistemas",
    "sistema web sob medida",
    "landing page",
    "desenvolvimento web",
    "automação para empresas",
    "site institucional",
    "dashboard empresarial",
  ],
  alternates: { canonical: "/" },
  // As imagens de compartilhamento vêm de src/app/opengraph-image.tsx,
  // gerado dinamicamente. Não declarar `images` aqui para não sobrescrevê-lo.
  openGraph: {
    siteName: "PeriniHub",
    title: "PeriniHub | Criação de Sites e Desenvolvimento de Sistemas",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "PeriniHub | Criação de Sites e Desenvolvimento de Sistemas",
    description: SITE_DESCRIPTION,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "PeriniHub",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  logo: `${SITE_URL}/perinihub-logo.png`,
  image: `${SITE_URL}/perinihub-logo.png`,
  email: "contato@perinihub.com.br",
  areaServed: "BR",
  serviceType: [
    "Criação de sites",
    "Desenvolvimento de sistemas web",
    "Automação de processos",
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
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
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
