"use client";

import { FlaskConical, LoaderCircle, Plug, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { connectMetaManual, markRead, sendTemplateMessage, sendText, simulateInbound } from "@/app/ai-sales/[org]/whatsapp-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

/** Atualiza a tela periodicamente (novas mensagens e status) enquanto ela está visível. */
export function AutoRefresh({ seconds = 8, slug, conversationId }: { seconds?: number; slug?: string; conversationId?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (slug && conversationId) void markRead(slug, conversationId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds, slug, conversationId]);
  return null;
}

type Template = { id: string; name: string; category: string; body: string };

function variablesOf(body: string) {
  return [...new Set(body.match(/\{\{\d+\}\}/g) ?? [])];
}

/**
 * Caixa de envio. Dentro da janela de 24 h: texto livre. Fora dela: só
 * template aprovado (o gate do banco confere de novo, inclusive consentimento).
 */
export function Composer({ slug, conversationId, inWindow, templates, disabledReason }: { slug: string; conversationId: string; inWindow: boolean; templates: Template[]; disabledReason?: string }) {
  const [mode, setMode] = useState<"text" | "template">(inWindow ? "text" : "template");
  const [textResult, textAction, textPending] = useActionState<ActionResult | null, FormData>(sendText.bind(null, slug, conversationId), null);
  const [tplResult, tplAction, tplPending] = useActionState<ActionResult | null, FormData>(sendTemplateMessage.bind(null, slug, conversationId), null);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const textRef = useRef<HTMLFormElement>(null);
  // Um id por tentativa: reenviar o mesmo formulário (duplo clique, retry) não duplica.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const template = useMemo(() => templates.find((item) => item.id === templateId), [templates, templateId]);

  useEffect(() => {
    if (textResult?.ok || tplResult?.ok) {
      textRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRequestId(crypto.randomUUID());
    }
  }, [textResult, tplResult]);

  if (disabledReason) return <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{disabledReason}</p>;

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Tipo de mensagem" className="flex gap-1 text-sm">
        <button type="button" role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")} className={`rounded-full px-3 py-1 font-medium ${mode === "text" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Mensagem
        </button>
        <button type="button" role="tab" aria-selected={mode === "template"} onClick={() => setMode("template")} className={`rounded-full px-3 py-1 font-medium ${mode === "template" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Template aprovado
        </button>
      </div>

      {mode === "text" ? (
        <form ref={textRef} action={textAction} className="grid gap-2">
          <input type="hidden" name="requestId" value={requestId} />
          {!inWindow && <p className="text-xs text-amber-700 dark:text-amber-300">Fora da janela de 24 h: mensagem livre será bloqueada. Use um template aprovado.</p>}
          <textarea name="body" required maxLength={4096} rows={3} aria-label="Mensagem" placeholder="Escreva a resposta…" className={`${inputClass} h-auto py-2`} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass("primary")} disabled={textPending}>
              {textPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Enviar
            </button>
            <ResultMessage result={textResult} />
          </div>
        </form>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template aprovado. Sincronize em Configurações → WhatsApp.</p>
      ) : (
        <form action={tplAction} className="grid gap-2">
          <input type="hidden" name="requestId" value={requestId} />
          <label className="grid gap-1.5">
            <span className={labelClass}>Template</span>
            <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className={inputClass}>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category === "marketing" ? "marketing" : item.category === "utility" ? "utilidade" : "autenticação"})
                </option>
              ))}
            </select>
          </label>
          {template && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{template.body}</p>}
          {template &&
            variablesOf(template.body).map((variable) => (
              <label key={`${template.id}-${variable}`} className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Variável {variable}</span>
                <input name="param" required maxLength={500} className={inputClass} />
              </label>
            ))}
          <p className="text-xs text-muted-foreground">Templates de marketing exigem consentimento vigente para marketing; o sistema bloqueia se faltar.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass("primary")} disabled={tplPending}>
              {tplPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Enviar template
            </button>
            <ResultMessage result={tplResult} />
          </div>
        </form>
      )}
    </div>
  );
}

export function SimulatorForm({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(simulateInbound.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
      <label className="grid gap-1.5">
        <span className={labelClass}>Telefone</span>
        <input name="phone" required defaultValue="(11) 98888-7777" className={`${inputClass} sm:w-40`} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Nome</span>
        <input name="name" maxLength={80} defaultValue="Cliente de teste" className={`${inputClass} sm:w-44`} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Mensagem recebida</span>
        <input name="body" required maxLength={1000} placeholder="Olá, quero um orçamento" className={inputClass} />
      </label>
      <button type="submit" className={buttonClass("secondary")} disabled={pending}>
        <FlaskConical className="h-4 w-4" aria-hidden="true" /> Simular
      </button>
      <div className="sm:col-span-4">
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

export function ManualConnectForm({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(connectMetaManual.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
      <label className="grid gap-1.5">
        <span className={labelClass}>WhatsApp Business Account ID (WABA)</span>
        <input name="wabaId" required inputMode="numeric" className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Phone Number ID</span>
        <input name="phoneNumberId" required inputMode="numeric" className={inputClass} />
      </label>
      <label className="grid gap-1.5 sm:col-span-2">
        <span className={labelClass}>Token de acesso (usuário do sistema)</span>
        <input name="token" type="password" required minLength={20} maxLength={1000} className={inputClass} />
        <span className="text-xs text-muted-foreground">Guardado criptografado no Vault. Depois de salvo, só aparecem os 4 últimos caracteres.</span>
      </label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="coexistence" className="h-4 w-4 accent-brand-600" />
        Número em coexistência (continua no app WhatsApp Business do celular)
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Plug className="h-4 w-4" aria-hidden="true" /> {pending ? "Validando na Meta…" : "Conectar"}
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}
