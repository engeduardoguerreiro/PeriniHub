import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";

import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");
  // Páginas institucionais: a data do build é a da última alteração publicada.
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified },
    { url: `${SITE_URL}/clientes`, lastModified },
  ];
}
