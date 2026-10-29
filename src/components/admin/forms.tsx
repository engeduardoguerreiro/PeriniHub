"use client";

import { Plus, Save } from "lucide-react";
import { useActionState } from "react";

import {
  createSource,
  updateAgentModel,
  updateSettings,
  type ActionResult,
} from "@/app/admin/(painel)/noticias/actions";

import { buttonClass, ResultMessage } from "./action-button";
import { inputClass, labelClass } from "./ui";

type Category = { id: string; name: string };

export function SourceForm({ categories }: { categories: Category[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createSource, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className={labelClass}>Nome</span>
        <input name="name" required minLength={2} maxLength={120} className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Site</span>
        <input name="websiteUrl" type="url" required placeholder="https://" className={inputClass} />
      </label>
      <label className="grid gap-1.5 sm:col-span-2">
        <span className={labelClass}>Feed RSS/Atom (https)</span>
        <input name="feedUrl" type="url" required placeholder="https://exemplo.com/feed.xml" className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Categoria padrão</span>
        <select name="categoryId" className={inputClass} defaultValue="">
          <option value="">Definida pela curadoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Confiabilidade</span>
        <select name="trustLevel" className={inputClass} defaultValue="official">
          <option value="official">Oficial (fonte primária)</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("dark")} disabled={pending}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {pending ? "Validando feed…" : "Cadastrar fonte"}
        </button>
        <ResultMessage result={result} />
      </div>
      <p className="text-xs text-ink-900/55 sm:col-span-2">
        Antes de salvar, o feed é baixado com as mesmas proteções do coletor (sem endereços internos, tamanho e tempo limitados) e precisa ter itens.
        Cadastre apenas fontes cujos termos permitam o uso do feed.
      </p>
    </form>
  );
}

type Settings = {
  approval_required: boolean;
  source_images_enabled: boolean;
  auto_publish_enabled: boolean;
  daily_publication_limit: number;
  min_relevance_score: number;
  max_candidates_per_run: number;
  monthly_cost_limit: number;
  schedule_times: string[];
  schedule_weekdays: number[];
  allowed_categories: string[] | null;
  timezone: string;
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function SettingsForm({ settings, categories }: { settings: Settings; categories: Category[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateSettings, null);
  const allowed = new Set(settings.allowed_categories ?? categories.map((category) => category.id));

  return (
    <form action={action} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className={`${labelClass} mb-1`}>Publicação</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="approvalRequired" defaultChecked={settings.approval_required} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>
            <span className="font-medium text-ink-900">Exigir aprovação humana</span>
            <span className="block text-ink-900/60">Recomendado. Nenhum artigo vai ao ar sem um editor aprovar.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="autoPublishEnabled" defaultChecked={settings.auto_publish_enabled} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>
            <span className="font-medium text-ink-900">Publicação automática</span>
            <span className="block text-ink-900/60">
              Publica sozinho artigos aprovados. Com aprovação humana desligada, publica artigos verificados e sem risco alto.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="sourceImagesEnabled" defaultChecked={settings.source_images_enabled} className="mt-1 h-4 w-4 accent-brand-600" />
          <span>
            <span className="font-medium text-ink-900">Usar imagens das fontes</span>
            <span className="block text-ink-900/60">
              Usa a imagem de divulgação da notícia original como capa, com crédito à fonte. Os direitos continuam do autor; desligado, o
              portal usa capas próprias.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5">
          <span className={labelClass}>Limite diário de publicações</span>
          <input type="number" name="dailyPublicationLimit" min={0} max={50} defaultValue={settings.daily_publication_limit} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Relevância mínima (0–100)</span>
          <input type="number" name="minRelevanceScore" min={0} max={100} defaultValue={settings.min_relevance_score} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Candidatos por coleta</span>
          <input type="number" name="maxCandidatesPerRun" min={1} max={100} defaultValue={settings.max_candidates_per_run} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Teto mensal de IA (US$)</span>
          <input type="number" name="monthlyCostLimit" min={0} max={1000} step="0.5" defaultValue={settings.monthly_cost_limit} className={inputClass} />
        </label>
      </div>

      <fieldset>
        <legend className={`${labelClass} mb-2`}>Dias de coleta</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((label, day) => (
            <label key={label} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="scheduleWeekdays" value={day} defaultChecked={settings.schedule_weekdays.includes(day)} className="h-4 w-4 accent-brand-600" />
              {label}
            </label>
          ))}
        </div>
        <span className="mt-1 block text-xs text-ink-900/55">
          Cada coleta pode redigir até o limite diário de artigos (~US$ 0,05 por artigo). Menos dias = menos gasto de IA.
        </span>
      </fieldset>

      <label className="grid gap-1.5">
        <span className={labelClass}>Horários de coleta ({settings.timezone})</span>
        <input name="scheduleTimes" defaultValue={settings.schedule_times.join(", ")} placeholder="06:00, 12:00, 17:00" className={`${inputClass} max-w-md`} />
        <span className="text-xs text-ink-900/55">Formato HH:MM separado por vírgula, em múltiplos de 5 minutos. O agendador verifica a cada 15 minutos.</span>
      </label>

      <fieldset>
        <legend className={`${labelClass} mb-2`}>Categorias permitidas na curadoria</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowedCategories" value={category.id} defaultChecked={allowed.has(category.id)} className="h-4 w-4 accent-brand-600" />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass("dark")} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar configurações
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

type AgentModel = {
  agent_name: string;
  provider: string;
  model: string;
  max_output_tokens: number;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  enabled: boolean;
};

export function AgentModelForm({ model, label, description, readOnly }: { model: AgentModel; label: string; description: string; readOnly: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateAgentModel, null);
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-ink-900/8 bg-white p-5">
      <input type="hidden" name="agentName" value={model.agent_name} />
      <input type="hidden" name="provider" value={model.provider} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">{label}</h2>
          <p className="text-xs text-ink-900/60">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={model.enabled} disabled={readOnly} className="h-4 w-4 accent-brand-600" />
          Ativo
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={labelClass}>Modelo ({model.provider})</span>
          <input name="model" defaultValue={model.model} required readOnly={readOnly} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Máx. tokens de saída</span>
          <input type="number" name="maxOutputTokens" min={256} max={32000} defaultValue={model.max_output_tokens} readOnly={readOnly} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>US$ / 1M tokens de entrada</span>
          <input type="number" name="inputPrice" min={0} step="0.01" defaultValue={model.input_price_per_mtok} readOnly={readOnly} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>US$ / 1M tokens de saída</span>
          <input type="number" name="outputPrice" min={0} step="0.01" defaultValue={model.output_price_per_mtok} readOnly={readOnly} className={inputClass} />
        </label>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass("secondary")} disabled={pending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar
          </button>
          <ResultMessage result={result} />
        </div>
      )}
    </form>
  );
}
