// Rotas do AI Sales e validação de destinos de redirecionamento.

export const AI_SALES_HOME = "/ai-sales";
export const AI_SALES_LOGIN = "/ai-sales/login";
export const AI_SALES_PLATFORM = "/ai-sales/platform";

/** Páginas acessíveis sem sessão (o proxy não redireciona ao login). */
const PUBLIC_PREFIXES = ["/ai-sales/login", "/ai-sales/recuperar-senha", "/ai-sales/auth/callback", "/ai-sales/convite/"];

export function isPublicAiSalesPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

export const orgPath = (slug: string, path = "dashboard") => `/ai-sales/${slug}/${path}`;

/**
 * Aceita só caminhos internos do AI Sales como destino pós-login. Bloqueia
 * open redirect (`//evil.com`, `https://...`, `/\evil`) e qualquer rota fora
 * de /ai-sales.
 */
export function safeNextPath(next: unknown, fallback = AI_SALES_HOME) {
  if (typeof next !== "string" || next.length > 300) return fallback;
  if (!/^\/ai-sales(?:\/[A-Za-z0-9\-._~%/]*)?(?:\?[A-Za-z0-9\-._~%&=]*)?$/.test(next)) return fallback;
  if (next.includes("//") || next.includes("\\")) return fallback;
  return next;
}

/** Slug de empresa: minúsculas, números e hífens (3–48), igual ao check do banco. */
export const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export function isValidOrgSlug(slug: string) {
  return ORG_SLUG_PATTERN.test(slug);
}

/** Segmentos estáticos de /ai-sales: uma empresa não pode usar esses nomes. */
const RESERVED_SLUGS = new Set(["login", "recuperar-senha", "redefinir-senha", "auth", "convite", "selecionar-empresa", "platform", "api", "admin", "ai-sales"]);

export function isReservedOrgSlug(slug: string) {
  return RESERVED_SLUGS.has(slug);
}

export function slugifyOrgName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
