"use client";

import { CalendarPlus, LoaderCircle, MessageSquarePlus, Plus, Save, Upload, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import {
  addActivity,
  createCompany,
  createLead,
  createOpportunity,
  createTask,
  importCsv,
  recordConsent,
  setContactTags,
  suppressContact,
  updateCompany,
  updateContact,
  updateLead,
  type ImportResult,
} from "@/app/ai-sales/[org]/crm-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import {
  CHANNEL_LABELS,
  LEGAL_BASIS_LABELS,
  PURPOSE_LABELS,
  QUALIFICATION_LABELS,
  SUPPRESSION_LABELS,
} from "@/features/ai-sales/crm/labels";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

type Option = { id: string; name: string };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Submit({ pending, children, icon: Icon = Save }: { pending: boolean; children: React.ReactNode; icon?: typeof Save }) {
  return (
    <button type="submit" className={buttonClass("primary")} disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

// --- Lead ---------------------------------------------------------------------

export function NewLeadForm({ slug, stages, sources, people, defaultOwner }: { slug: string; stages: Option[]; sources: Option[]; people: Option[]; defaultOwner: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createLead.bind(null, slug), null);
  const [consent, setConsent] = useState(false);
  return (
    <form action={action} className="grid gap-5">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold">Contato</legend>
        <Field label="Nome">
          <input name="fullName" required maxLength={160} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Empresa (opcional)">
          <input name="companyName" maxLength={200} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <input name="phone" type="tel" inputMode="tel" maxLength={40} placeholder="(11) 99999-8888" className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" maxLength={254} className={inputClass} />
        </Field>
      </fieldset>
      <p className="-mt-2 text-xs text-muted-foreground">Telefone ou e-mail já cadastrado reaproveita o contato existente.</p>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold">Lead</legend>
        <Field label="Título (opcional)">
          <input name="title" maxLength={160} placeholder="Ex.: Sistema de pedidos para 3 lojas" className={inputClass} />
        </Field>
        <Field label="Etapa">
          <select name="stageId" defaultValue={stages[0]?.id} className={inputClass}>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Origem">
          <select name="sourceId" defaultValue={sources[0]?.id ?? ""} className={inputClass}>
            <option value="">Sem origem</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável">
          <select name="ownerId" defaultValue={defaultOwner} className={inputClass}>
            <option value="">Sem responsável</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Autorização para WhatsApp</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>
            O contato autorizou receber mensagens desta empresa pelo WhatsApp.
            <span className="block text-muted-foreground">Marque só se houver autorização real. Etapa e qualificação não equivalem a autorização.</span>
          </span>
        </label>
        {consent && (
          <Field label="Como foi obtida">
            <input name="consentSource" required minLength={3} maxLength={200} placeholder="Ex.: pediu orçamento pelo formulário do site em 28/10" className={inputClass} />
          </Field>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} icon={UserPlus}>
          Criar lead
        </Submit>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

type LeadValues = { stageId: string; ownerId: string | null; qualification: string; score: number | null; title: string | null };

export function LeadControls({ slug, leadId, values, stages, people, readOnly }: { slug: string; leadId: string; values: LeadValues; stages: Option[]; people: Option[]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const save = (input: Record<string, unknown>) => startTransition(async () => setResult(await updateLead(slug, leadId, input)));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Etapa">
        <select defaultValue={values.stageId} disabled={readOnly || pending} onChange={(event) => save({ stageId: event.target.value })} className={inputClass}>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Responsável">
        <select defaultValue={values.ownerId ?? ""} disabled={readOnly || pending} onChange={(event) => save({ ownerId: event.target.value })} className={inputClass}>
          <option value="">Sem responsável</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Interesse">
        <select defaultValue={values.qualification} disabled={readOnly || pending} onChange={(event) => save({ qualification: event.target.value })} className={inputClass}>
          {Object.entries(QUALIFICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pontuação (0–100)">
        <input
          type="number"
          min={0}
          max={100}
          defaultValue={values.score ?? ""}
          disabled={readOnly || pending}
          onBlur={(event) => event.target.value !== String(values.score ?? "") && save({ score: event.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4" aria-live="polite">
        {pending ? <span className="text-sm text-muted-foreground">Salvando…</span> : <ResultMessage result={result} />}
      </div>
    </div>
  );
}

// --- Atividades, tarefas e oportunidades ------------------------------------

export function ActivityForm({ slug, leadId, contactId }: { slug: string; leadId?: string; contactId?: string | null }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(addActivity.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="leadId" value={leadId ?? ""} />
      <input type="hidden" name="contactId" value={contactId ?? ""} />
      <div className="flex flex-wrap gap-2">
        <select name="kind" defaultValue="note" aria-label="Tipo de registro" className={`${inputClass} w-auto`}>
          <option value="note">Nota interna</option>
          <option value="call">Ligação</option>
          <option value="email">E-mail</option>
          <option value="meeting">Reunião</option>
        </select>
      </div>
      <textarea name="body" required maxLength={4000} rows={3} aria-label="Anotação" placeholder="O que aconteceu, próximos passos…" className={`${inputClass} h-auto py-2`} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} icon={MessageSquarePlus}>
          Registrar
        </Submit>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

export function TaskForm({ slug, leadId, people, defaultAssignee }: { slug: string; leadId: string; people: Option[]; defaultAssignee: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createTask.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Tarefa">
        <input name="title" required minLength={2} maxLength={200} placeholder="Ex.: Enviar proposta" className={inputClass} />
      </Field>
      <Field label="Prazo">
        <input name="dueAt" type="datetime-local" className={inputClass} />
      </Field>
      <Field label="Para">
        <select name="assigneeId" defaultValue={defaultAssignee} className={`${inputClass} w-auto`}>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <Submit pending={pending} icon={CalendarPlus}>
        Criar
      </Submit>
      <div className="sm:col-span-4">
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

export function OpportunityForm({ slug, leadId }: { slug: string; leadId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createOpportunity.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Oportunidade">
        <input name="title" required minLength={2} maxLength={160} placeholder="Ex.: Implantação Perini Food" className={inputClass} />
      </Field>
      <Field label="Valor (R$)">
        <input name="amount" inputMode="decimal" maxLength={20} placeholder="0,00" className={`${inputClass} w-32`} />
      </Field>
      <Field label="Previsão">
        <input name="expectedClose" type="date" className={inputClass} />
      </Field>
      <Submit pending={pending} icon={Plus}>
        Adicionar
      </Submit>
      <div className="sm:col-span-4">
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

// --- Consentimento e supressão -----------------------------------------------

export function ConsentForm({ slug, contactId }: { slug: string; contactId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(recordConsent.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="contactId" value={contactId} />
      <Field label="Situação">
        <select name="status" defaultValue="granted" className={inputClass}>
          <option value="granted">Autorizou</option>
          <option value="revoked">Revogou</option>
        </select>
      </Field>
      <Field label="Canal">
        <select name="channel" defaultValue="whatsapp" className={inputClass}>
          {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Finalidade">
        <select name="purpose" defaultValue="marketing" className={inputClass}>
          {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Base legal (LGPD)">
        <select name="legalBasis" defaultValue="consent" className={inputClass}>
          {Object.entries(LEGAL_BASIS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Origem" className="sm:col-span-2">
        <input name="source" required minLength={3} maxLength={200} placeholder="Ex.: respondeu 'sim' no WhatsApp em 28/10" className={inputClass} />
      </Field>
      <Field label="Evidência (opcional)" className="sm:col-span-2">
        <textarea name="evidence" maxLength={1000} rows={2} placeholder="Texto apresentado, link do formulário, protocolo…" className={`${inputClass} h-auto py-2`} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit pending={pending}>Registrar</Submit>
        <ResultMessage result={result} />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Registros não são editados nem apagados: uma mudança vira um registro novo, com autor e data.</p>
    </form>
  );
}

export function SuppressForm({ slug, contactId }: { slug: string; contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [channel, setChannel] = useState("whatsapp");
  const [reason, setReason] = useState("opt_out");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Canal">
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className={`${inputClass} w-auto`}>
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motivo">
          <select value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputClass} w-auto`}>
            {Object.entries(SUPPRESSION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className={buttonClass("danger")}
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await suppressContact(slug, { contactId, channel, reason })))}
        >
          Descadastrar
        </button>
      </div>
      <ResultMessage result={result} />
      <p className="text-xs text-muted-foreground">Entra na lista de supressão e revoga o consentimento do canal. Vale mesmo se o contato for recriado.</p>
    </div>
  );
}

// --- Contato, empresa e tags --------------------------------------------------

type ContactValues = { full_name: string; phone: string; email: string | null; job_title: string | null; city: string | null; state: string | null; notes: string | null };

export function ContactForm({ slug, contactId, values, readOnly }: { slug: string; contactId: string; values: ContactValues; readOnly: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateContact.bind(null, slug, contactId), null);
  return (
    <form action={action} className="grid gap-4">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input name="fullName" required maxLength={160} defaultValue={values.full_name} className={inputClass} />
        </Field>
        <Field label="Cargo">
          <input name="jobTitle" maxLength={120} defaultValue={values.job_title ?? ""} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input name="phone" type="tel" maxLength={40} defaultValue={values.phone} className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" maxLength={254} defaultValue={values.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="city" maxLength={80} defaultValue={values.city ?? ""} className={inputClass} />
        </Field>
        <Field label="UF">
          <input name="state" maxLength={2} defaultValue={values.state ?? ""} className={`${inputClass} w-20 uppercase`} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea name="notes" maxLength={4000} rows={3} defaultValue={values.notes ?? ""} className={`${inputClass} h-auto py-2`} />
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending={pending}>Salvar contato</Submit>
          <ResultMessage result={result} />
        </div>
      )}
    </form>
  );
}

type CompanyValues = { name: string; document: string | null; city: string | null; state: string | null; website: string | null; notes: string | null };

export function CompanyForm({ slug, companyId, values, readOnly }: { slug: string; companyId?: string; values?: CompanyValues; readOnly?: boolean }) {
  const bound = companyId ? updateCompany.bind(null, slug, companyId) : createCompany.bind(null, slug);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(bound, null);
  return (
    <form action={action} className="grid gap-4">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" required minLength={2} maxLength={200} defaultValue={values?.name ?? ""} className={inputClass} />
        </Field>
        <Field label="CNPJ">
          <input name="document" inputMode="numeric" maxLength={18} defaultValue={values?.document ?? ""} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="city" maxLength={80} defaultValue={values?.city ?? ""} className={inputClass} />
        </Field>
        <Field label="UF">
          <input name="state" maxLength={2} defaultValue={values?.state ?? ""} className={`${inputClass} w-20 uppercase`} />
        </Field>
        <Field label="Site" className="sm:col-span-2">
          <input name="website" type="url" maxLength={300} placeholder="https://" defaultValue={values?.website ?? ""} className={inputClass} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea name="notes" maxLength={4000} rows={3} defaultValue={values?.notes ?? ""} className={`${inputClass} h-auto py-2`} />
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending={pending}>{companyId ? "Salvar empresa" : "Criar empresa"}</Submit>
          <ResultMessage result={result} />
        </div>
      )}
    </form>
  );
}

export function TagEditor({ slug, contactId, tags, readOnly }: { slug: string; contactId: string; tags: string[]; readOnly: boolean }) {
  const [value, setValue] = useState(tags.join(", "));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={readOnly}
          aria-label="Tags separadas por vírgula"
          placeholder="cliente, feira 2026, food service"
          className={`${inputClass} min-w-0 flex-1`}
        />
        {!readOnly && (
          <button
            type="button"
            className={buttonClass("secondary")}
            disabled={pending}
            onClick={() => startTransition(async () => setResult(await setContactTags(slug, contactId, value.split(","))))}
          >
            Salvar tags
          </button>
        )}
      </div>
      <ResultMessage result={result} />
    </div>
  );
}

// --- Importação -----------------------------------------------------------------

export function ImportForm({ slug, sources }: { slug: string; sources: Option[] }) {
  const [result, action, pending] = useActionState<ImportResult | null, FormData>(importCsv.bind(null, slug), null);
  const [declared, setDeclared] = useState(false);
  const csvSource = sources.find((source) => /csv/i.test(source.name));
  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4">
        <Field label="Arquivo CSV (até 2 MB e 5.000 linhas)">
          <input name="file" type="file" accept=".csv,text/csv" required className={`${inputClass} h-auto py-2`} />
        </Field>
        <Field label="De onde vieram estes contatos?">
          <input name="origin" required minLength={3} maxLength={500} placeholder="Ex.: inscritos no evento X que aceitaram contato" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origem dos leads">
            <select name="sourceId" defaultValue={csvSource?.id ?? ""} className={inputClass}>
              <option value="">Sem origem</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <input type="checkbox" name="createLeads" defaultChecked className="h-4 w-4 accent-brand-600" />
            Criar um lead para cada contato novo
          </label>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
          <input type="checkbox" name="consentDeclared" checked={declared} onChange={(event) => setDeclared(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>
            Declaro que os contatos marcados na coluna <strong>consentimento whatsapp</strong> autorizaram receber mensagens desta empresa, e que guardo a prova.
            <span className="block text-muted-foreground">Sem esta declaração, a coluna é ignorada e ninguém fica autorizado.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending={pending} icon={Upload}>
            Importar
          </Submit>
          {!result?.summary && <ResultMessage result={result} />}
        </div>
      </form>

      {result?.summary && (
        <div role="status" className="grid gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
          <p className="font-medium">{result.message}</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Linhas", result.summary.total],
              ["Contatos novos", result.summary.createdContacts],
              ["Atualizados", result.summary.updatedContacts],
              ["Leads criados", result.summary.createdLeads],
              ["Rejeitadas", result.summary.rejected],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-display text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {result.summary.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium">Linhas rejeitadas</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-muted-foreground">
                {result.summary.errors.map((error) => (
                  <li key={error.line}>
                    Linha {error.line}: {error.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
