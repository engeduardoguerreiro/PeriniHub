"use client";

import { LoaderCircle, LogIn, TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import { signIn, type LoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { error: null, email: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const error = state.error ?? notice ?? null;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.error) || undefined}
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error) || undefined}
          className="h-11"
        />
      </div>
      <div role="alert" aria-live="assertive" className="empty:hidden">
        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-brand-600 text-white hover:bg-brand-700"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
