import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard, FormFallback } from "@/components/ai-sales/auth-card";
import { LoginForm } from "@/components/ai-sales/auth-forms";
import { getSalesUser } from "@/features/ai-sales/auth/dal";
import { safeNextPath } from "@/features/ai-sales/paths";

export const metadata: Metadata = { title: "Entrar" };

const notices: Record<string, string> = {
  link: "Link inválido ou expirado. Peça um novo.",
};

// Sessão e ?next= lidos dentro do Suspense: o resto fica no shell estático.
async function LoginGate({ searchParams }: Pick<PageProps<"/ai-sales/login">, "searchParams">) {
  const { next, erro } = await searchParams;
  const target = safeNextPath(next);
  if (await getSalesUser()) redirect(target);
  return <LoginForm next={target} notice={typeof erro === "string" ? notices[erro] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/ai-sales/login">) {
  return (
    <AuthCard title="Entrar no AI Sales" description="CRM e inteligência comercial da PeriniHub. Acesso por convite.">
      <Suspense fallback={<FormFallback />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
