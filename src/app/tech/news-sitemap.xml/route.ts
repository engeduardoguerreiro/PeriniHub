import { cacheLife, cacheTag } from "next/cache";

import { NEWS_TAGS } from "@/lib/news/cache-tags";
import { buildNewsSitemap } from "@/lib/news/feeds";
import { getPublishedEntries } from "@/lib/news/queries";

async function sitemap() {
  "use cache";
  // A janela de 2 dias depende do relógio: revalida de hora em hora mesmo sem publicação.
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);
  return buildNewsSitemap(await getPublishedEntries(1000), Date.now());
}

export async function GET() {
  return new Response(await sitemap(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
