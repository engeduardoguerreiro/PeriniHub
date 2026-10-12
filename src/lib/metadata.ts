import type { Metadata } from "next";

// O merge de metadata do Next é raso: uma página que declara `openGraph`
// substitui o objeto inteiro do layout. Por isso cada página espalha esta base.
export const sharedOpenGraph = {
  siteName: "PeriniHub",
  type: "website",
  locale: "pt_BR",
} satisfies Metadata["openGraph"];
