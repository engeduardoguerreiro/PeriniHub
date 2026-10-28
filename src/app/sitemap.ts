import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { NEWS_TAGS } from "@/lib/news/cache-tags";
import { getPublishedEntries } from "@/lib/news/queries";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);

  // Páginas institucionais: a data do build é a da última alteração publicada.
  const buildTime = new Date();
  const entries = await getPublishedEntries(5000);
  const latest = entries[0] ? new Date(entries[0].updatedAt) : buildTime;

  return [
    { url: SITE_URL, lastModified: buildTime },
    { url: `${SITE_URL}/clientes`, lastModified: buildTime },
    { url: `${SITE_URL}/tech`, lastModified: latest },
    ...entries.map((entry) => ({ url: `${SITE_URL}/tech/${entry.slug}`, lastModified: new Date(entry.updatedAt) })),
  ];
}
