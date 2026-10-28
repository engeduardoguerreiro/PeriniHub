import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormFallback } from "@/components/ai-sales/auth-card";
import { getMemberships, isPlatformAdmin, requireSalesUser } from "@/features/ai-sales/auth/dal";
import { AI_SALES_PLATFORM, orgPath } from "@/features/ai-sales/paths";

// Entrada do produto: uma empresa ativa → direto para ela; várias → seletor;
// nenhuma (superadmin) → plataforma.
async function Router() {
  const user = await requireSalesUser();
  const active = (await getMemberships()).filter((membership) => membership.status === "active");
  if (active.length === 1) redirect(orgPath(active[0].slug));
  if (active.length === 0 && (await isPlatformAdmin(user.id))) redirect(AI_SALES_PLATFORM);
  redirect("/ai-sales/selecionar-empresa");
  return null;
}

export default function AiSalesHome() {
  return (
    <main id="conteudo" className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Suspense fallback={<FormFallback />}>
          <Router />
        </Suspense>
      </div>
    </main>
  );
}
