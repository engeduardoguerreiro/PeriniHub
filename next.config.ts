import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Previews da Vercel injetam a toolbar de comentários (vercel.live).
const isVercelPreview = process.env.VERCEL_ENV === "preview";

// O site é estático: nonce exigiria renderização dinâmica, então os scripts
// inline do Next (payload RSC) e o JSON-LD exigem 'unsafe-inline'. Não há
// scripts de terceiros; o WhatsApp só aparece em links.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${isVercelPreview ? " https://vercel.live" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${isVercelPreview ? " https://vercel.live https://vercel.com" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}${isVercelPreview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${isVercelPreview ? "https://vercel.live" : "'none'"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
const supabaseStorage = supabaseHost
  ? new URL(`https://${supabaseHost}/storage/v1/object/public/**`)
  : null;

const nextConfig: NextConfig = {
  // Cache explícito com `use cache` + cacheTag: as páginas do portal /tech
  // entram no shell estático e são invalidadas por tag ao publicar.
  cacheComponents: true,
  // Prefetch do App Shell por rota (padrão da próxima major); artigos fora do
  // generateStaticParams recebem o shell na hora e viram estáticos após a 1ª visita.
  partialPrefetching: true,
  images: {
    // Padrão do Next 16, explícito para não liberar outras qualidades por engano.
    qualities: [75],
    // Capas licenciadas do portal ficam no Storage público do Supabase do projeto.
    remotePatterns: supabaseStorage ? [supabaseStorage] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Painel e APIs internas: fora de buscadores mesmo se um link vazar.
        source: "/:prefix(admin|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      // Consolida o trafego no dominio principal, evitando conteudo duplicado
      // entre www, o subdominio da Vercel e perinihub.com.br.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.perinihub.com.br" }],
        destination: "https://perinihub.com.br/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "perinihub.vercel.app" }],
        destination: "https://perinihub.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
