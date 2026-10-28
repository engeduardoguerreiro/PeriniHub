import { NextResponse, type NextRequest } from "next/server";

import { AI_SALES_LOGIN, safeNextPath } from "@/features/ai-sales/paths";
import { isAiSalesEnabled } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Retorno dos links do Supabase Auth (recuperação de senha, fluxo PKCE): troca
// o código pela sessão neste navegador e segue para um destino interno.
export async function GET(request: NextRequest) {
  if (!isAiSalesEnabled()) return new NextResponse(null, { status: 404 });
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSalesSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const login = new URL(AI_SALES_LOGIN, request.url);
  login.searchParams.set("erro", "link");
  return NextResponse.redirect(login);
}
