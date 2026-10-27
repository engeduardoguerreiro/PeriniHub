import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";
import { Brand } from "@/components/perinihub/brand";
import { getAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Entrar" };

const notices: Record<string, string> = {
  permissao: "Sua conta não tem permissão para essa área.",
};

// Lê a sessão e o ?erro= dentro do Suspense: o resto da página fica no shell estático.
async function LoginGate({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { erro } = await searchParams;
  const user = await getAdminUser();
  if (user && erro !== "permissao") redirect("/admin/noticias");
  const notice = typeof erro === "string" ? notices[erro] : undefined;
  return <LoginForm notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main
      id="conteudo"
      className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-ink-950 px-4 py-16"
    >
      <div className="hero-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grid-lines-dark absolute inset-0 -z-10" aria-hidden="true" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand tone="dark" />
        </div>
        <div className="rounded-2xl border border-ink-900/8 bg-white p-6 shadow-[0_20px_60px_-30px_rgb(0_0_0/0.6)] sm:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900">Painel PeriniHub Tech</h1>
          <p className="mt-1 mb-6 text-sm text-ink-900/65">Acesso restrito à equipe editorial.</p>
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-ink-900/5" />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
