"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { createSource, createStage, deleteStage, moveStage, updateStage } from "@/app/ai-sales/[org]/crm-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { STAGE_COLOR_NAMES, STAGE_COLORS, type StageColor } from "@/features/ai-sales/crm/labels";
import { cn } from "@/lib/utils";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass } from "./ui";

type Stage = { id: string; name: string; color: string; is_qualified: boolean; is_won: boolean; is_lost: boolean };

const FLAG_LABELS = { none: "Etapa comum", qualified: "Conta como qualificado", won: "Ganho (fecha)", lost: "Perdido (fecha)" } as const;

function stageFlag(stage: Stage): keyof typeof FLAG_LABELS {
  if (stage.is_won) return "won";
  if (stage.is_lost) return "lost";
  return stage.is_qualified ? "qualified" : "none";
}

function ColorSelect({ value, onChange, name }: { value?: string; onChange?: (value: string) => void; name?: string }) {
  return (
    <select name={name} value={value} defaultValue={value ? undefined : "slate"} onChange={(event) => onChange?.(event.target.value)} aria-label="Cor" className={`${inputClass} w-auto`}>
      {Object.entries(STAGE_COLOR_NAMES).map(([color, label]) => (
        <option key={color} value={color}>
          {label}
        </option>
      ))}
    </select>
  );
}

function StageRow({ slug, stage, first, last }: { slug: string; stage: Stage; first: boolean; last: boolean }) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [flag, setFlag] = useState<string>(stageFlag(stage));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) => startTransition(async () => setResult(await action()));

  return (
    <li className="grid gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("h-3 w-3 shrink-0 rounded-full", STAGE_COLORS[color as StageColor] ?? STAGE_COLORS.slate)} aria-hidden="true" />
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} aria-label="Nome da etapa" className={`${inputClass} min-w-0 flex-1`} />
        <ColorSelect value={color} onChange={setColor} />
        <select value={flag} onChange={(event) => setFlag(event.target.value)} aria-label="Tipo da etapa" className={`${inputClass} w-auto`}>
          {Object.entries(FLAG_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => run(() => updateStage(slug, stage.id, { name, color, flag }))} aria-label={`Salvar ${stage.name}`}>
          <Save className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={buttonClass("secondary")} disabled={pending || first} onClick={() => run(() => moveStage(slug, stage.id, "up"))} aria-label={`Subir ${stage.name}`}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={buttonClass("secondary")} disabled={pending || last} onClick={() => run(() => moveStage(slug, stage.id, "down"))} aria-label={`Descer ${stage.name}`}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={buttonClass("danger")} disabled={pending} onClick={() => run(() => deleteStage(slug, stage.id))} aria-label={`Excluir ${stage.name}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {result?.message && <ResultMessage result={result} />}
    </li>
  );
}

export function StageList({ slug, stages }: { slug: string; stages: Stage[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createStage.bind(null, slug), null);
  return (
    <div className="grid gap-4">
      <ul className="divide-y divide-border">
        {stages.map((stage, index) => (
          <StageRow key={`${stage.id}:${stage.name}:${stage.color}:${stageFlag(stage)}`} slug={slug} stage={stage} first={index === 0} last={index === stages.length - 1} />
        ))}
      </ul>
      <form action={action} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <input name="name" required minLength={2} maxLength={40} placeholder="Nova etapa" aria-label="Nome da nova etapa" className={`${inputClass} min-w-0 flex-1`} />
        <ColorSelect name="color" />
        <select name="flag" defaultValue="none" aria-label="Tipo da nova etapa" className={`${inputClass} w-auto`}>
          {Object.entries(FLAG_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
        </button>
        <ResultMessage result={result} />
      </form>
    </div>
  );
}

const SOURCE_KINDS = {
  manual: "Manual",
  form: "Formulário",
  csv: "Importação",
  ads: "Anúncios",
  api: "Integração",
  research: "Pesquisa",
  whatsapp_inbound: "WhatsApp (entrada)",
  referral: "Indicação",
} as const;

export function SourceForm({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createSource.bind(null, slug), null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <input name="name" required minLength={2} maxLength={60} placeholder="Nova origem" aria-label="Nome da nova origem" className={`${inputClass} min-w-0 flex-1`} />
      <select name="kind" defaultValue="manual" aria-label="Tipo da origem" className={`${inputClass} w-auto`}>
        {Object.entries(SOURCE_KINDS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button type="submit" className={buttonClass("primary")} disabled={pending}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
      </button>
      <ResultMessage result={result} />
    </form>
  );
}
