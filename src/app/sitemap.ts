import type { MetadataRoute } from "next";

const SITE_URL = "https://perinihub.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/clientes`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
