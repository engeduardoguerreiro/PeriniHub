"use client";

import { CalendarClock, CheckCircle2, Archive, RefreshCw, Send, XCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  approveArticle,
  archiveArticle,
  publishArticleNow,
  rejectArticle,
  reverifyArticle,
  scheduleArticle,
  type ActionResult,
} from "@/app/admin/(painel)/noticias/actions";

import { ActionButton, buttonClass, ConfirmDialog, ResultMessage } from "./action-button";
import { inputClass, labelClass } from "./ui";

type Props = { articleId: string; status: string; title: string };

function RejectButton({ articleId }: { articleId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass("danger")} disabled={pending} onClick={() => dialogRef.current?.showModal()}>
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Rejeitar
      </button>
      <ResultMessage result={result} />
      <ConfirmDialog
        dialogRef={dialogRef}
        confirm={{ title: "Rejeitar artigo", description: "O artigo sai da fila editorial. O motivo fica registrado na auditoria.", confirmLabel: "Rejeitar" }}
        onConfirm={() => startTransition(async () => setResult(await rejectArticle({ articleId, reason })))}
      >
        <label className={`${labelClass} mt-4 block`} htmlFor={`reject-${articleId}`}>
          Motivo
        </label>
        <textarea
          id={`reject-${articleId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          className={`${inputClass} mt-1.5 h-auto py-2`}
        />
      </ConfirmDialog>
    </span>
  );
}

function ScheduleForm({ articleId }: { articleId: string }) {
  const [when, setWhen] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await scheduleArticle({ articleId, when })));
      }}
    >
      <label className="grid gap-1">
        <span className={labelClass}>Agendar (horário de Brasília)</span>
        <input type="datetime-local" required value={when} onChange={(event) => setWhen(event.target.value)} className={`${inputClass} w-auto`} />
      </label>
      <button type="submit" className={buttonClass("secondary")} disabled={pending || !when}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Agendar
      </button>
      <ResultMessage result={result} />
    </form>
  );
}

/** Ações editoriais disponíveis conforme o status atual do artigo. */
export function ArticleActions({ articleId, status, title }: Props) {
  const canApprove = ["draft", "needs_review", "blocked", "rejected"].includes(status);
  const canPublish = ["approved", "scheduled"].includes(status);
  const canSchedule = ["approved", "needs_review", "blocked", "scheduled"].includes(status);
  const canReject = !["published", "rejected", "archived"].includes(status);
  const canReverify = ["draft", "needs_review", "blocked"].includes(status);
  const canArchive = !["archived"].includes(status);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <ActionButton
            variant="primary"
            action={() => approveArticle(articleId)}
            confirm={
              status === "blocked"
                ? {
                    title: "Aprovar artigo bloqueado",
                    description: "A verificação automática encontrou problemas. Aprove só se você revisou as afirmações marcadas e as fontes.",
                    confirmLabel: "Revisei e aprovo",
                  }
                : undefined
            }
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Aprovar
          </ActionButton>
        )}
        {canPublish && (
          <ActionButton
            variant="dark"
            action={() => publishArticleNow(articleId)}
            confirm={{
              title: "Publicar agora",
              description: `"${title}" ficará público no portal, na home e no RSS. Essa ação é registrada na auditoria.`,
              confirmLabel: "Publicar",
            }}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Publicar agora
          </ActionButton>
        )}
        {canReverify && (
          <ActionButton action={() => reverifyArticle(articleId)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reverificar
          </ActionButton>
        )}
        {canReject && <RejectButton articleId={articleId} />}
        {canArchive && (
          <ActionButton
            variant="danger"
            action={() => archiveArticle(articleId)}
            confirm={{
              title: status === "published" ? "Retirar do ar" : "Arquivar artigo",
              description:
                status === "published"
                  ? "O artigo deixa de aparecer no portal imediatamente. O link passa a dar 404."
                  : "O artigo sai da fila editorial.",
              confirmLabel: status === "published" ? "Retirar do ar" : "Arquivar",
            }}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {status === "published" ? "Retirar do ar" : "Arquivar"}
          </ActionButton>
        )}
      </div>
      {canSchedule && <ScheduleForm articleId={articleId} />}
    </div>
  );
}
