"use client";

import { KeyRound, LoaderCircle, LogIn, Mail, TriangleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { createAccountAndAccept, type InviteState } from "@/app/ai-sales/convite/[token]/actions";
import { signIn, type LoginState } from "@/app/ai-sales/login/actions";
import { requestPasswordReset, type RecoverState } from "@/app/ai-sales/recuperar-senha/actions";
import { updatePassword, type ResetState } from "@/app/ai-sales/redefinir-senha/actions";

import { buttonClass } from "./button-styles";
import { inputClass, labelClass } from "./ui";

function FormError({ message }: { message: string | null | undefined }) {
  return (
    <div role="alert" aria-live="assertive" className="empty:hidden">
      {message && (
        <p className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ pending, idle, busy, icon: Icon }: { pending: boolean; idle: string; busy: string; icon: typeof LogIn }) {
  return (
    <button type="submit" disabled={pending} className={`${buttonClass("primary")} h-11`}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {pending ? busy : idle}
    </button>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null, email: "" });
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="grid gap-2">
        <span className={labelClass}>E-mail</span>
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} aria-invalid={Boolean(state.error) || undefined} className={`${inputClass} h-11`} />
      </label>
      <label className="grid gap-2">
        <span className={labelClass}>Senha</span>
        <input name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(state.error) || undefined} className={`${inputClass} h-11`} />
      </label>
      <FormError message={state.error ?? notice} />
      <SubmitButton pending={pending} idle="Entrar" busy="Entrando…" icon={LogIn} />
      <Link href="/ai-sales/recuperar-senha" className="text-center text-sm font-medium text-primary hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(requestPasswordReset, { error: null, sent: false });
  if (state.sent) {
    return (
      <p role="status" className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
        Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele expira em 1 hora e precisa ser aberto neste mesmo navegador.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-5" noValidate>
      <label className="grid gap-2">
        <span className={labelClass}>E-mail da conta</span>
        <input name="email" type="email" autoComplete="username" required className={`${inputClass} h-11`} />
      </label>
      <FormError message={state.error} />
      <SubmitButton pending={pending} idle="Enviar link" busy="Enviando…" icon={Mail} />
      <Link href="/ai-sales/login" className="text-center text-sm font-medium text-primary hover:underline">
        Voltar ao login
      </Link>
    </form>
  );
}

function PasswordFields() {
  return (
    <>
      <label className="grid gap-2">
        <span className={labelClass}>Nova senha</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} aria-describedby="senha-regra" className={`${inputClass} h-11`} />
        <span id="senha-regra" className="text-xs text-muted-foreground">
          Mínimo de 10 caracteres.
        </span>
      </label>
      <label className="grid gap-2">
        <span className={labelClass}>Confirme a senha</span>
        <input name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className={`${inputClass} h-11`} />
      </label>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(updatePassword, { error: null });
  return (
    <form action={action} className="grid gap-5" noValidate>
      <PasswordFields />
      <FormError message={state.error} />
      <SubmitButton pending={pending} idle="Salvar senha" busy="Salvando…" icon={KeyRound} />
    </form>
  );
}

export function CreateAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createAccountAndAccept, { error: null });
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-2">
        <span className={labelClass}>E-mail</span>
        <input type="email" value={email} readOnly autoComplete="username" className={`${inputClass} h-11 opacity-75`} />
      </label>
      <label className="grid gap-2">
        <span className={labelClass}>Seu nome</span>
        <input name="fullName" autoComplete="name" required minLength={2} maxLength={120} className={`${inputClass} h-11`} />
      </label>
      <PasswordFields />
      <FormError message={state.error} />
      <SubmitButton pending={pending} idle="Criar conta e entrar" busy="Criando…" icon={UserPlus} />
    </form>
  );
}
