import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";

// Renova o token do Supabase antes de renderizar o painel. Server Components
// não conseguem gravar cookies, então sem isso a sessão expiraria no meio do uso.
// Não é a barreira de autorização: cada página, action e route handler
// confere o papel no servidor (lib/auth/admin.ts).
export async function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/admin/:path*"],
};
