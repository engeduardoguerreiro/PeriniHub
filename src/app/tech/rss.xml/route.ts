import { cacheLife, cacheTag } from "next/cache";

import { NEWS_TAGS } from "@/lib/news/cache-tags";
import { buildRssFeed } from "@/lib/news/feeds";
import { getLatestArticles } from "@/lib/news/queries";

async function feed() {
  "use cache";
  cacheLife("hours");
  cacheTag(NEWS_TAGS.list);
  return buildRssFeed(await getLatestArticles(30));
}

export async function GET() {
  return new Response(await feed(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
