import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonte de display: dá personalidade aos títulos sem prejudicar a leitura do corpo.
const displayFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://perinihub.vercel.app";
const SITE_DESCRIPTION =
  "Criação de sites, landing pages e desenvolvimento de sistemas web sob medida para empresas. Painéis, integrações e automações. Orçamento em até 24 horas.";

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
  image: `${SITE_URL}/perinihub-logo.png`,
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
        {children}
      </body>
    </html>
  );
}
