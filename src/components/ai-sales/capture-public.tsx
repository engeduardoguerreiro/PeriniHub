"use client";

import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { PublicForm } from "@/features/ai-sales/capture/public-form";
import { HONEYPOT_FIELD } from "@/features/ai-sales/capture/constants";
import { cn } from "@/lib/utils";

import { buttonClass } from "./button-styles";
import { inputClass, labelClass } from "./ui";

// Formulário público. Funciona sem JavaScript (POST nativo → 303 de volta);
// com JavaScript envia JSON e mostra o resultado sem sair da página.

type State = { status: "idle" | "sending" | "sent" | "error"; message?: string };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function CaptureFormFields({ form }: { form: PublicForm }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const asks = (field: string) => form.fields.includes(field);
  const both = asks("phone") && asks("email");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending" });
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/ai-sales/forms/${form.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { ok: boolean; message: string };
      setState({ status: body.ok ? "sent" : "error", message: body.message });
    } catch {
      setState({ status: "error", message: "Não foi possível enviar agora. Tente novamente." });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }

  return (
    <form action={`/api/ai-sales/forms/${form.key}`} method="post" onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
      <input type="hidden" name="consent_version" value={form.consentVersion} />
      {/* Honeypot: fora da tela e da ordem de tabulação. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Site da empresa
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <Field label="Nome">
        <input name="full_name" required minLength={2} maxLength={160} autoComplete="name" className={inputClass} />
      </Field>
      {asks("phone") && (
        <Field label={both ? "WhatsApp / telefone" : "WhatsApp / telefone (obrigatório)"} hint="Com DDD.">
          <input name="phone" type="tel" inputMode="tel" required={!both} maxLength={40} autoComplete="tel" className={inputClass} />
        </Field>
      )}
      {asks("email") && (
        <Field label={both ? "E-mail" : "E-mail (obrigatório)"} hint={both ? "Informe telefone ou e-mail." : undefined}>
          <input name="email" type="email" required={!both} maxLength={254} autoComplete="email" className={inputClass} />
        </Field>
      )}
      {asks("company") && (
        <Field label="Empresa">
          <input name="company" maxLength={200} autoComplete="organization" className={inputClass} />
        </Field>
      )}
      {asks("job_title") && (
        <Field label="Cargo">
          <input name="job_title" maxLength={120} autoComplete="organization-title" className={inputClass} />
        </Field>
      )}
      {asks("message") && (
        <Field label="Mensagem">
          <textarea name="message" rows={4} maxLength={2000} className={`${inputClass} h-auto py-2`} />
        </Field>
      )}
      <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" name="consent" value="on" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
        <span className="whitespace-pre-line">{form.consentText}</span>
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">A autorização é opcional e pode ser revogada a qualquer momento (no WhatsApp, basta responder &quot;SAIR&quot;).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass("primary")} disabled={state.status === "sending"}>
          <Send className="h-4 w-4" aria-hidden="true" /> {state.status === "sending" ? "Enviando…" : "Enviar"}
        </button>
        <span role="status" aria-live="polite" className={cn("text-sm", "text-red-700 dark:text-red-300")}>
          {state.status === "error" ? state.message : ""}
        </span>
      </div>
    </form>
  );
}
