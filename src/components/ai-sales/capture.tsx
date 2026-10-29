"use client";

import { Check, Copy, FileInput, Search } from "lucide-react";
import { useActionState, useId, useState } from "react";

import { createCaptureForm, createCompanyFromCnpj, updateCaptureForm } from "@/app/ai-sales/[org]/capture-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { FORM_FIELD_LABELS } from "@/features/ai-sales/capture/constants";
import { CHANNEL_LABELS, PURPOSE_LABELS } from "@/features/ai-sales/crm/labels";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

type Option = { id: string; name: string };

export type CaptureFormValues = {
  name: string;
  headline: string;
  description: string | null;
  fields: string[];
  consentText: string;
  channels: string[];
  purposes: string[];
  successMessage: string;
  sourceId: string | null;
};

const DEFAULT_VALUES: CaptureFormValues = {
  name: "",
  headline: "Fale com a gente",
  description: null,
  fields: ["phone", "email", "company"],
  consentText: "Autorizo o contato pelo WhatsApp para responder este pedido e acompanhar a proposta comercial.",
  channels: ["whatsapp"],
  purposes: ["sales_followup"],
  successMessage: "Recebemos seus dados. Em breve entraremos em contato.",
  sourceId: null,
};

function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Checks({ legend, name, options, checked, disabled }: { legend: string; name: string; options: [string, string][]; checked: string[]; disabled?: boolean }) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className={`${labelClass} mb-1`}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={value} defaultChecked={checked.includes(value)} className="h-4 w-4 accent-brand-600" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Criação e edição de formulário. Mudar texto, canais ou finalidades gera nova versão da autorização. */
export function CaptureFormEditor({ slug, formId, values = DEFAULT_VALUES, sources, readOnly }: { slug: string; formId?: string; values?: CaptureFormValues; sources: Option[]; readOnly?: boolean }) {
  const handler = formId ? updateCaptureForm.bind(null, slug, formId) : createCaptureForm.bind(null, slug);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(handler, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={readOnly} className="contents">
        <Field label="Nome interno">
          <input name="name" required minLength={2} maxLength={80} defaultValue={values.name} className={inputClass} />
        </Field>
        <Field label="Origem do lead">
          <select name="sourceId" defaultValue={values.sourceId ?? ""} className={inputClass}>
            <option value="">Formulário do site (padrão)</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Título da página" className="sm:col-span-2">
          <input name="headline" required minLength={2} maxLength={120} defaultValue={values.headline} className={inputClass} />
        </Field>
        <Field label="Texto de apresentação (opcional)" className="sm:col-span-2">
          <textarea name="description" maxLength={1000} rows={3} defaultValue={values.description ?? ""} className={`${inputClass} h-auto py-2`} />
        </Field>
        <div className="sm:col-span-2">
          <Checks legend="Campos pedidos (além do nome; telefone ou e-mail obrigatório)" name="fields" options={Object.entries(FORM_FIELD_LABELS)} checked={values.fields} />
        </div>
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:col-span-2">
          <p className="text-sm font-semibold">Autorização de contato (caixa de seleção opcional, nunca pré-marcada)</p>
          <Field label="Texto exato apresentado ao titular" hint="Fica guardado por versão; cada envio aponta para a versão que a pessoa viu.">
            <textarea name="consentText" required minLength={20} maxLength={2000} rows={3} defaultValue={values.consentText} className={`${inputClass} h-auto py-2`} />
          </Field>
          <Checks legend="Canais autorizados" name="channels" options={Object.entries(CHANNEL_LABELS)} checked={values.channels} />
          <Checks legend="Finalidades" name="purposes" options={Object.entries(PURPOSE_LABELS)} checked={values.purposes} />
        </div>
        <Field label="Mensagem após o envio" className="sm:col-span-2">
          <input name="successMessage" required minLength={2} maxLength={300} defaultValue={values.successMessage} className={inputClass} />
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className={buttonClass("primary")} disabled={pending}>
            <FileInput className="h-4 w-4" aria-hidden="true" /> {formId ? "Salvar" : "Criar rascunho"}
          </button>
          <ResultMessage result={result} />
        </div>
      )}
    </form>
  );
}

/** Texto copiável (link público e código para incorporar). */
export function CopyBlock({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const fieldClass = "min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-2 font-mono text-xs";
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea id={id} readOnly value={value} rows={4} onFocus={(event) => event.currentTarget.select()} className={`${fieldClass} py-2`} />
        ) : (
          <input id={id} readOnly value={value} onFocus={(event) => event.currentTarget.select()} className={`${fieldClass} h-9`} />
        )}
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

/** Prospecção: cadastra a empresa pelos dados públicos do CNPJ. */
export function ProspectByCnpjForm({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createCompanyFromCnpj.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="CNPJ" hint="Consulta a base pública da Receita Federal (via BrasilAPI). Sócios, telefone e e-mail cadastrais não são importados.">
        <input name="document" required inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createLead" defaultChecked className="h-4 w-4 accent-brand-600" />
        Criar lead &quot;empresa identificada&quot; para mim
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Search className="h-4 w-4" aria-hidden="true" /> {pending ? "Consultando…" : "Buscar e cadastrar"}
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}
