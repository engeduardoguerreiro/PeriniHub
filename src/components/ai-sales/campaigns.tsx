"use client";

import { Megaphone, Plus } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { createCampaign, createFollowupRule } from "@/app/ai-sales/[org]/campaigns-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { PURPOSE_LABELS, QUALIFICATION_LABELS } from "@/features/ai-sales/crm/labels";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

type Option = { id: string; name: string };
type NumberOption = { id: string; name: string; accountId: string };
type TemplateOption = { id: string; name: string; accountId: string; category: string; body: string };

function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Checks({ legend, name, options }: { legend: string; name: string; options: Option[] }) {
  if (!options.length) return null;
  return (
    <fieldset className="grid gap-2">
      <legend className={`${labelClass} mb-1`}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={option.id} className="h-4 w-4 accent-brand-600" />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Número oficial → templates aprovados dele → uma caixa por variável. */
function TemplatePicker({ numbers, templates }: { numbers: NumberOption[]; templates: TemplateOption[] }) {
  const [numberId, setNumberId] = useState(numbers[0]?.id ?? "");
  const accountId = numbers.find((number) => number.id === numberId)?.accountId;
  const available = useMemo(() => templates.filter((template) => template.accountId === accountId), [templates, accountId]);
  const [templateId, setTemplateId] = useState(available[0]?.id ?? "");
  const template = available.find((item) => item.id === templateId) ?? available[0];
  const variables = [...new Set(template?.body.match(/\{\{\d+\}\}/g) ?? [])];
  return (
    <>
      <Field label="Número (só oficial)">
        <select name="phoneNumberId" value={numberId} onChange={(event) => setNumberId(event.target.value)} className={inputClass}>
          {numbers.map((number) => (
            <option key={number.id} value={number.id}>
              {number.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Template aprovado">
        <select name="templateId" value={template?.id ?? ""} onChange={(event) => setTemplateId(event.target.value)} className={inputClass}>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.category})
            </option>
          ))}
        </select>
      </Field>
      {template && <p className="rounded-lg bg-muted px-3 py-2 text-sm sm:col-span-2">{template.body}</p>}
      {variables.map((variable) => (
        <Field key={`${template?.id}-${variable}`} label={`Variável ${variable}`} hint="Use {{nome}} para o primeiro nome e {{empresa}} para a empresa do contato.">
          <input name="param" required maxLength={500} defaultValue={variable === "{{1}}" ? "{{nome}}" : ""} className={inputClass} />
        </Field>
      ))}
    </>
  );
}

export function CampaignForm({ slug, numbers, templates, stages, sources, tags }: { slug: string; numbers: NumberOption[]; templates: TemplateOption[]; stages: Option[]; sources: Option[]; tags: Option[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createCampaign.bind(null, slug), null);
  if (!numbers.length) return <p className="text-sm text-muted-foreground">Conecte um número oficial (ou o simulado) com templates aprovados em Configurações → WhatsApp.</p>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome">
        <input name="name" required minLength={2} maxLength={120} className={inputClass} />
      </Field>
      <Field label="Finalidade (exigida no consentimento)">
        <select name="purpose" defaultValue="marketing" className={inputClass}>
          {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Objetivo" className="sm:col-span-2">
        <input name="objective" maxLength={1000} className={inputClass} />
      </Field>
      <TemplatePicker numbers={numbers} templates={templates} />
      <div className="grid gap-4 rounded-xl border border-border p-4 sm:col-span-2">
        <p className="text-sm font-semibold">Público (vazio = todos os contatos com consentimento)</p>
        <Checks legend="Etapas" name="stageIds" options={stages} />
        <Checks legend="Origens" name="sourceIds" options={sources} />
        <Checks legend="Tags" name="tagIds" options={tags} />
        <Checks legend="Interesse" name="qualifications" options={Object.entries(QUALIFICATION_LABELS).map(([id, name]) => ({ id, name }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Janela: início">
          <input name="windowStart" type="time" defaultValue="09:00" className={inputClass} />
        </Field>
        <Field label="Janela: fim">
          <input name="windowEnd" type="time" defaultValue="18:00" className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Por hora">
          <input name="hourlyLimit" type="number" min={1} max={1000} defaultValue={20} className={inputClass} />
        </Field>
        <Field label="Por dia">
          <input name="dailyLimit" type="number" min={1} max={10000} defaultValue={100} className={inputClass} />
        </Field>
        <Field label="Total">
          <input name="totalLimit" type="number" min={1} max={100000} defaultValue={500} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Megaphone className="h-4 w-4" aria-hidden="true" /> Criar rascunho
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

export function FollowupRuleForm({ slug, numbers, templates, stages }: { slug: string; numbers: NumberOption[]; templates: TemplateOption[]; stages: Option[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createFollowupRule.bind(null, slug), null);
  if (!numbers.length) return <p className="text-sm text-muted-foreground">Precisa de um número oficial com templates aprovados.</p>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome da regra">
        <input name="name" required minLength={2} maxLength={120} placeholder="Ex.: Proposta sem resposta" className={inputClass} />
      </Field>
      <Field label="Parado na etapa há (dias)">
        <input name="idleDays" type="number" min={1} max={180} defaultValue={7} className={inputClass} />
      </Field>
      <TemplatePicker numbers={numbers} templates={templates} />
      <div className="sm:col-span-2">
        <Checks legend="Só nestas etapas (vazio = todas abertas)" name="stageIds" options={stages} />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="Máx. tentativas por lead">
          <input name="maxAttempts" type="number" min={1} max={5} defaultValue={2} className={inputClass} />
        </Field>
        <Field label="Intervalo mínimo (dias)">
          <input name="minIntervalDays" type="number" min={1} max={60} defaultValue={3} className={inputClass} />
        </Field>
        <Field label="Máx. envios por rodada">
          <input name="maxPerRun" type="number" min={1} max={200} defaultValue={20} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("secondary")} disabled={pending}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Criar regra
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}
