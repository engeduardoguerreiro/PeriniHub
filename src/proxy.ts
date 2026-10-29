import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AI_SALES_LOGIN, isPublicAiSalesPath } from "@/features/ai-sales/paths";
import { getSalesPublicEnv, isAiSalesEnabled } from "@/lib/env";
import { isValidSlug, slugify } from "@/lib/news/slug";

const LOGIN_PATH = "/admin/login";
const TECH_RESERVED = new Set(["busca", "categoria", "rss.xml", "news-sitemap.xml"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/tech/")) return techSlugGuard(request);
  if (pathname === "/ai-sales" || pathname.startsWith("/ai-sales/")) return aiSalesSession(request);
  return refreshAdminSession(request);
}

/**
 * Com Cache Components a página do artigo faz streaming, e um notFound()
 * lá dentro sai com status 200 (noindex). Aqui, antes do render, garantimos
 * 404 real para slugs malformados e 308 para variações (maiúsculas, acentos)
 * do slug canônico. Slugs bem formados seguem para a página.
 */
function techSlugGuard(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const raw = segments[1];
  if (segments.length !== 2 || TECH_RESERVED.has(raw)) return NextResponse.next();

  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return notFound(request);
  }
  if (isValidSlug(slug)) return NextResponse.next();

  const canonical = slugify(slug, 120);
  if (canonical && isValidSlug(canonical)) {
    const url = request.nextUrl.clone();
    url.pathname = `/tech/${canonical}`;
    return NextResponse.redirect(url, 308);
  }
  return notFound(request);
}

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/tech/__placeholder__", request.url), { status: 404 });
}

// Renova o token do Supabase antes de renderizar o painel. Server Components
// não conseguem gravar cookies, então sem isso a sessão expiraria no meio do uso.
// Não é a barreira de autorização: cada página, action e route handler
// confere o papel no servidor (lib/auth/admin.ts).
async function refreshAdminSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  // Sem sessão válida: 307 direto para o login, antes de renderizar o painel.
  if (!data?.claims.sub && request.nextUrl.pathname !== LOGIN_PATH) {
    const login = new URL(LOGIN_PATH, request.url);
    const redirect = NextResponse.redirect(login, 307);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

// AI Sales: mesmo papel do refreshAdminSession, com o Supabase próprio do
// produto. Com a flag desligada, tudo em /ai-sales é 404 (o módulo não existe
// para o público). Também aqui não é a barreira de autorização: o DAL
// (features/ai-sales/auth/dal.ts) confere sessão, vínculo e papel.
async function aiSalesSession(request: NextRequest) {
  if (!isAiSalesEnabled()) {
    return NextResponse.rewrite(new URL("/__ai-sales-indisponivel", request.url), { status: 404 });
  }
  const env = getSalesPublicEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;
  if (!data?.claims.sub && !isPublicAiSalesPath(pathname)) {
    const login = new URL(AI_SALES_LOGIN, request.url);
    if (pathname !== "/ai-sales") login.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(login, 307);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/tech/:path+", "/ai-sales", "/ai-sales/:path*"],
};
