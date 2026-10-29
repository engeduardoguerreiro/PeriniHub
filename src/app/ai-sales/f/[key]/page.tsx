import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { CaptureFormFields } from "@/components/ai-sales/capture-public";
import { FormFallback } from "@/components/ai-sales/auth-card";
import { Notice } from "@/components/ai-sales/ui";
import { loadPublicForm } from "@/features/ai-sales/capture/public-form";
import { SUBMIT_MESSAGES } from "@/features/ai-sales/capture/submission";

// Página pública de um formulário de captação (landing simples). O link é o
// public_key; formulário pausado, em rascunho ou de empresa suspensa não aparece.

export const metadata: Metadata = { title: "Formulário" };

async function PublicFormContent({ params, searchParams }: PageProps<"/ai-sales/f/[key]">) {
  await connection();
  const [{ key }, query] = await Promise.all([params, searchParams]);
  const form = await loadPublicForm(key);
  if (!form) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Formulário indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este link não está ativo. Fale diretamente com a empresa que o enviou.</p>
      </section>
    );
  }
  const sent = query.enviado === "1";
  const errorCode = typeof query.erro === "string" ? query.erro : null;
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-[0_20px_60px_-30px_rgb(0_0_0/0.6)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{form.organization}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{form.headline}</h1>
      {form.description && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{form.description}</p>}
      <div className="mt-6">
        {sent ? (
          <Notice>{form.successMessage}</Notice>
        ) : (
          <>
            {errorCode && (
              <div className="mb-4">
                <Notice tone="warning">{SUBMIT_MESSAGES[errorCode] ?? SUBMIT_MESSAGES.error}</Notice>
              </div>
            )}
            <CaptureFormFields form={form} />
          </>
        )}
      </div>
    </section>
  );
}

export default function PublicFormPage(props: PageProps<"/ai-sales/f/[key]">) {
  return (
    <main id="conteudo" className="flex flex-1 justify-center bg-muted/40 px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <Suspense fallback={<FormFallback />}>
          <PublicFormContent {...props} />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Seus dados são usados só para o contato que você autorizar. Formulário processado por PeriniHub.
        </p>
      </div>
    </main>
  );
}
