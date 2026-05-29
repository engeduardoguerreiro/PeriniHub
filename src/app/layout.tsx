import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://perinihub.vercel.app"),
  title: "PeriniHub | Tecnologia, SaaS e Soluções Digitais",
  description:
    "A PeriniHub desenvolve soluções digitais, plataformas SaaS, sistemas web, automações, sites e produtos digitais para empresas em crescimento.",
  openGraph: {
    title: "PeriniHub",
    description: "Ecossistema de tecnologia, SaaS e soluções digitais.",
    images: [
      {
        url: "/perinihub-logo.png",
        width: 1600,
        height: 900,
        alt: "Logo PeriniHub",
      },
    ],
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "PeriniHub",
    description: "Ecossistema de tecnologia, SaaS e soluções digitais.",
    images: ["/perinihub-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
