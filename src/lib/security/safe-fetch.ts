import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

import { Agent, fetch } from "undici";

import { isBlockedAddress } from "./ip";

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_url"
  | "blocked_address"
  | "too_many_redirects"
  | "http_error"
  | "too_large"
  | "timeout"
  | "unsupported_content"
  | "network";

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Prefixos de content-type aceitos (ex.: "text/html"). Vazio = qualquer texto. */
  accept?: string[];
  /** Aceita application/octet-stream se o corpo começar como XML (servidores mal configurados). */
  sniffXml?: boolean;
};

export type SafeFetchResult = { url: string; status: number; contentType: string; body: string };

export const USER_AGENT = "PeriniHubTechBot/1.0 (+https://perinihub.com.br/tech)";

/**
 * Valida a URL antes de qualquer conexão: só http(s), sem credenciais,
 * portas padrão e nada de hosts internos. IPs literais são checados aqui;
 * nomes de host são checados na resolução DNS (guardedLookup).
 */
export function assertPublicUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url", "URL inválida");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SafeFetchError("blocked_url", `Protocolo não permitido: ${url.protocol}`);
  }
  if (url.username || url.password) throw new SafeFetchError("blocked_url", "URL com credenciais");
  if (url.port && url.port !== "443" && url.port !== "80") throw new SafeFetchError("blocked_url", `Porta não permitida: ${url.port}`);

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const singleLabel = !host.includes(".") && !host.includes(":");
  if (singleLabel || host === "localhost" || /\.(localhost|local|internal|home\.arpa)$/.test(host)) {
    throw new SafeFetchError("blocked_url", "Host interno não permitido");
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isBlockedAddress(host)) throw new SafeFetchError("blocked_address", "Endereço IP não permitido");
  }
  return url;
}

/**
 * Resolve o DNS e recusa endereços internos no momento da conexão: como o
 * socket usa exatamente o IP validado, um DNS que muda de resposta entre a
 * checagem e a conexão (DNS rebinding) não escapa.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, order: "ipv4first" }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, "", 0);
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return callback(new SafeFetchError("blocked_address", `Host resolve para endereço não permitido: ${hostname}`), "", 0);
    }
    if (options.all) return (callback as unknown as (err: null, all: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const agent = new Agent({
  connect: { lookup: guardedLookup, timeout: 10_000, autoSelectFamily: true },
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
});

async function readLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError("too_large", `Resposta maior que ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** GET seguro para conteúdo externo não confiável (feeds e páginas de notícia). */
export async function safeFetch(raw: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { maxBytes = 2_000_000, timeoutMs = 12_000, maxRedirects = 3, accept = [], sniffXml = false } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  let url = assertPublicUrl(raw);

  try {
    for (let redirects = 0; ; redirects++) {
      const response = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new SafeFetchError("http_error", "Redirect sem Location", response.status);
        if (redirects >= maxRedirects) throw new SafeFetchError("too_many_redirects", "Redirects demais");
        url = assertPublicUrl(new URL(location, url));
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new SafeFetchError("http_error", `HTTP ${response.status}`, response.status);
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      const sniffable = sniffXml && contentType.startsWith("application/octet-stream");
      const isText = /(^text\/|xml|json|html)/.test(contentType) || contentType === "" || sniffable;
      if (!isText || (!sniffable && accept.length > 0 && !accept.some((prefix) => contentType.startsWith(prefix)))) {
        await response.body?.cancel();
        throw new SafeFetchError("unsupported_content", `Content-Type não aceito: ${contentType || "?"}`);
      }

      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        await response.body?.cancel();
        throw new SafeFetchError("too_large", `Resposta maior que ${maxBytes} bytes`);
      }

      const body = await readLimited(response.body as ReadableStream<Uint8Array> | null, maxBytes);
      if (sniffable && !/^\s*(<\?xml|<rss|<feed|<rdf:RDF)/i.test(body.slice(0, 500))) {
        throw new SafeFetchError("unsupported_content", "Conteúdo binário não é XML");
      }
      return { url: url.toString(), status: response.status, contentType, body };
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) throw new SafeFetchError("timeout", `Tempo esgotado após ${timeoutMs} ms`);
    const cause = error instanceof Error && error.cause instanceof SafeFetchError ? error.cause : null;
    if (cause) throw cause;
    throw new SafeFetchError("network", error instanceof Error ? error.message : "Falha de rede");
  }
}
