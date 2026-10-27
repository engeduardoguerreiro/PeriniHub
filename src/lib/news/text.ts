import { createHash } from "node:crypto";

import { parse } from "node-html-parser";

// Normalização de texto e URLs usada na coleta e na deduplicação.

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|source|campaign)$/i;

/**
 * URL canônica para deduplicar: host minúsculo, sem fragmento, sem parâmetros
 * de rastreamento, parâmetros ordenados e sem barra final. Retorna null se inválida.
 */
export function canonicalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";

  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.test(key));
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de da do das dos e em no na nos nas por para com sem que se ao aos à às " +
    "the an and or of to in on for with from by at is are was be as its it this that new now how why what " +
    "mais muito como sobre entre após sua seu suas seus já"
  ).split(" "),
);

/** Minúsculas, sem acentos e sem pontuação. */
export function normalizeText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significativos de um título (sem stopwords), únicos. */
export function titleTokens(title: string): string[] {
  const tokens = normalizeText(title)
    .split(" ")
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return [...new Set(tokens)];
}

/** sha256 do título normalizado: a mesma notícia republicada em outra URL tem o mesmo fingerprint. */
export function titleFingerprint(title: string) {
  return createHash("sha256").update(titleTokens(title).sort().join(" ")).digest("hex");
}

/** Similaridade de Jaccard entre dois conjuntos de tokens (0 a 1). */
export function jaccard(a: readonly string[], b: readonly string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const intersection = a.filter((token) => setB.has(token)).length;
  return intersection / (new Set([...a, ...b]).size);
}

const NOISE_SELECTORS = "script, style, noscript, svg, iframe, form, nav, header, footer, aside, button, template, figure figcaption";

/**
 * Texto legível de um HTML não confiável: remove scripts e navegação,
 * prefere <article>/<main> e devolve só texto puro, com limite de tamanho.
 */
export function htmlToText(html: string, maxChars = 20_000) {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  for (const node of root.querySelectorAll(NOISE_SELECTORS)) node.remove();
  const main = root.querySelector("article") ?? root.querySelector("main") ?? root.querySelector("body") ?? root;
  const text = main.structuredText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/** Datas de feed: aceita só datas válidas e não futuras (tolerância de 1 dia para fusos). */
export function parseFeedDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value.trim());
  if (Number.isNaN(time)) return null;
  if (time > now + 24 * 60 * 60 * 1000 || time < Date.UTC(2000, 0, 1)) return null;
  return new Date(time).toISOString();
}
