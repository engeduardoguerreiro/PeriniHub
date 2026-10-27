import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getArticleBySlug } from "@/lib/news/queries";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Notícia do PeriniHub Tech";

// Lido no escopo do módulo (ver src/app/opengraph-image.tsx).
const logo = await readFile(join(process.cwd(), "public/perinihub-logo-dark.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export default async function ArticleOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getArticleBySlug((await params).slug);
  const title = article?.title ?? "PeriniHub Tech";
  const category = article?.category?.name ?? "Tecnologia";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#040b1c",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -160,
            width: 760,
            height: 640,
            display: "flex",
            background: "radial-gradient(closest-side, rgba(22,119,255,0.42), rgba(34,227,216,0.12), transparent)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={logoSrc} alt="" width={247} height={71} />
          <div
            style={{
              display: "flex",
              color: "#6ff3ea",
              fontSize: 24,
              letterSpacing: 4,
              textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              padding: "8px 20px",
            }}
          >
            {category}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: title.length > 90 ? 48 : 58,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontSize: 26 }}>perinihub.com.br/tech</div>
      </div>
    ),
    size,
  );
}
