import { imageSize } from "image-size";
import { parse } from "node-html-parser";

import { safeFetchBytes } from "@/lib/security/safe-fetch";

import type { Db } from "@/agents/types";

// Capas a partir da imagem de divulgação da notícia original (og:image e
// afins). A imagem é baixada com as proteções do coletor, validada pelo
// conteúdo real (não pelo cabeçalho) e hospedada no Storage do projeto.

export const COVER_BUCKET = "news-covers";

const ALLOWED = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
} as const;
type AllowedType = keyof typeof ALLOWED;

const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;

/** URLs de imagem de divulgação declaradas na página, em ordem de preferência. */
export function extractImageCandidates(html: string, pageUrl: string): string[] {
  const root = parse(html.slice(0, 500_000), { comment: false });
  const values = [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[property="twitter:image"]',
  ].flatMap((selector) => root.querySelectorAll(selector).map((node) => node.getAttribute("content") ?? ""));
  const linked = root.querySelector('link[rel="image_src"]')?.getAttribute("href");
  return resolveUnique([...values, linked ?? ""], pageUrl);
}

export function resolveUnique(urls: string[], base: string): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    const value = raw.trim();
    if (!value || value.startsWith("data:")) continue;
    try {
      const url = new URL(value, base);
      if ((url.protocol === "https:" || url.protocol === "http:") && !/\.svgz?$/i.test(url.pathname)) seen.add(url.toString());
    } catch {
      // URL inválida: ignora
    }
  }
  return [...seen];
}

export type ImageCheck =
  | { ok: true; type: AllowedType; mime: string; width: number; height: number }
  | { ok: false; reason: string };

/**
 * Confere o arquivo pelo conteúdo: formato raster permitido (nada de SVG,
 * que pode carregar script), tamanho mínimo (descarta ícones e logos) e
 * proporção plausível de capa.
 */
export function checkImage(bytes: Uint8Array): ImageCheck {
  let info;
  try {
    info = imageSize(bytes);
  } catch {
    return { ok: false, reason: "formato não reconhecido" };
  }
  const type = info.type === "jpeg" ? "jpg" : info.type;
  if (!type || !(type in ALLOWED)) return { ok: false, reason: `formato não permitido: ${info.type ?? "?"}` };
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return { ok: false, reason: `imagem pequena demais (${width}x${height})` };
  const ratio = width / height;
  if (ratio < 0.6 || ratio > 3.5) return { ok: false, reason: `proporção inadequada (${width}x${height})` };
  return { ok: true, type: type as AllowedType, mime: ALLOWED[type as AllowedType], width, height };
}

export type StoredCover = { url: string; sourceUrl: string; width: number; height: number };

/** Baixa a primeira candidata válida e grava no Storage. Retorna null se nenhuma servir. */
export async function storeCover(
  db: Db,
  articleId: string,
  candidates: string[],
  log?: (message: string, data?: Record<string, unknown>) => void,
): Promise<StoredCover | null> {
  for (const candidate of candidates.slice(0, 4)) {
    try {
      const image = await safeFetchBytes(candidate, { contentTypes: Object.values(ALLOWED), maxBytes: 5_000_000 });
      const check = checkImage(image.bytes);
      if (!check.ok) {
        log?.("imagem descartada", { url: candidate, motivo: check.reason });
        continue;
      }
      // Versão no nome do arquivo: trocar a capa não serve a antiga do cache
      // (o next/image só aceita URLs do Storage sem query string).
      const path = `articles/${articleId}-${Date.now().toString(36)}.${check.type}`;
      const { error } = await db.storage
        .from(COVER_BUCKET)
        .upload(path, image.bytes, { contentType: check.mime, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      const { data } = db.storage.from(COVER_BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, sourceUrl: image.url, width: check.width, height: check.height };
    } catch (error) {
      log?.("imagem indisponível", { url: candidate, erro: error instanceof Error ? error.message : String(error) });
    }
  }
  return null;
}
