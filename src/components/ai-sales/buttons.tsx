"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/features/ai-sales/action-result";
import { cn } from "@/lib/utils";

import { buttonClass, type ButtonVariant } from "./button-styles";

export function ResultMessage({ result }: { result: ActionResult | null }) {
  return (
    <span role="status" aria-live="polite" className={cn("text-sm", result?.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
      {result?.message}
    </span>
  );
}

type Confirm = { title: string; description: string; confirmLabel: string; reason?: boolean };

/**
 * Botão de ação com confirmação opcional. Com `reason`, o diálogo pede um
 * motivo (vai para a auditoria) e o passa à action.
 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  confirm,
  disabled,
}: {
  action: (reason?: string) => Promise<ActionResult>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: Confirm;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reasonId = useId();

  const run = (value?: string) => startTransition(async () => setResult(await action(value)));

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={buttonClass(variant)}
        disabled={disabled || pending}
        onClick={() => (confirm ? dialogRef.current?.showModal() : run())}
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
      <ResultMessage result={result} />
      {confirm && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-6 text-left text-card-foreground shadow-2xl backdrop:bg-ink-950/60"
        >
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {confirm.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{confirm.description}</p>
          {confirm.reason && (
            <label htmlFor={reasonId} className="mt-4 grid gap-1.5 text-sm font-medium">
              Motivo
              <textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </label>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => dialogRef.current?.close()}>
              Cancelar
            </button>
            <button
              type="button"
              className={buttonClass(variant === "danger" ? "danger" : "primary")}
              disabled={confirm.reason && reason.trim().length < 3}
              onClick={() => {
                dialogRef.current?.close();
                run(confirm.reason ? reason.trim() : undefined);
              }}
            >
              {confirm.confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </span>
  );
}

/** Link de convite exibido uma única vez, com botão de copiar. */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const inputId = useId();
  return (
    <div className="grid gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50">
      <label htmlFor={inputId} className="font-medium">
        Link do convite (válido por 7 dias, uso único). Copie agora: ele não será mostrado de novo.
      </label>
      <div className="flex gap-2">
        <input id={inputId} readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-300/60 bg-white/70 px-2 font-mono text-xs dark:bg-black/20" />
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-xs opacity-80">Envie para a pessoa por e-mail ou WhatsApp. Só a conta com o e-mail convidado consegue aceitar.</p>
    </div>
  );
}
