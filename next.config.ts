import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
