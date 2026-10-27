"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/app/admin/(painel)/noticias/actions";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-ink-900/12 bg-white text-ink-900 hover:border-brand-200 hover:bg-brand-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  dark: "bg-ink-900 text-white hover:bg-ink-800",
} as const;

export const buttonClass = (variant: keyof typeof variants = "secondary") =>
  cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
  );

type Confirm = { title: string; description: string; confirmLabel: string };

type ActionButtonProps = {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: keyof typeof variants;
  /** Ações destrutivas ou irreversíveis pedem confirmação. */
  confirm?: Confirm;
  disabled?: boolean;
};

export function ResultMessage({ result }: { result: ActionResult | null }) {
  return (
    <span role="status" aria-live="polite" className={cn("text-sm", result?.ok ? "text-emerald-700" : "text-red-700")}>
      {result?.message}
    </span>
  );
}

export function ConfirmDialog({
  dialogRef,
  confirm,
  onConfirm,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  confirm: Confirm;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-ink-900/10 bg-white p-6 text-left shadow-2xl backdrop:bg-ink-950/60"
    >
      <h2 id={titleId} className="font-display text-lg font-semibold text-ink-900">
        {confirm.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-900/70">{confirm.description}</p>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={buttonClass("secondary")} onClick={() => dialogRef.current?.close()}>
          Cancelar
        </button>
        <button
          type="button"
          className={buttonClass("dark")}
          onClick={() => {
            dialogRef.current?.close();
            onConfirm();
          }}
        >
          {confirm.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function ActionButton({ action, children, variant = "secondary", confirm, disabled }: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const run = () => startTransition(async () => setResult(await action()));

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
      {confirm && <ConfirmDialog dialogRef={dialogRef} confirm={confirm} onConfirm={run} />}
    </span>
  );
}
