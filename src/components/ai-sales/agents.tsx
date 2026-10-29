"use client";

import { FlaskConical, Play, Plus, Save, Search, Upload } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import {
  addKnowledgeDocument,
  createKnowledgeBase,
  runSupportAgent,
  saveAgentVersion,
  searchKnowledgeTest,
  testSdr,
  updateAgentSettings,
  type AgentActionResult,
} from "@/app/ai-sales/[org]/agents-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

type Option = { id: string; name: string };

function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type Settings = {
  type: string;
  name: string;
  objective: string | null;
  status: string;
  phone_number_id: string | null;
  auto_take_new_conversations: boolean;
  handoff_confidence: number;
  max_replies_per_conversation: number;
  daily_executions_limit: number;
};

export function AgentSettingsForm({ slug, agentId, values, numbers }: { slug: string; agentId: string; values: Settings; numbers: Option[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateAgentSettings.bind(null, slug, agentId), null);
  const sdr = values.type === "sdr";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome">
        <input name="name" required minLength={2} maxLength={80} defaultValue={values.name} className={inputClass} />
      </Field>
      <Field label="Situação" hint="Em teste: só o console de teste roda. Ativo: atua de verdade.">
        <select name="status" defaultValue={values.status} className={inputClass}>
          <option value="testing">Em teste</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </Field>
      <Field label="Objetivo" className="sm:col-span-2">
        <textarea name="objective" maxLength={1000} rows={2} defaultValue={values.objective ?? ""} className={`${inputClass} h-auto py-2`} />
      </Field>
      {sdr && (
        <>
          <Field label="Número de WhatsApp">
            <select name="phoneNumberId" defaultValue={values.phone_number_id ?? ""} className={inputClass}>
              <option value="">Nenhum</option>
              {numbers.map((number) => (
                <option key={number.id} value={number.id}>
                  {number.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <input type="checkbox" name="autoTake" defaultChecked={values.auto_take_new_conversations} className="h-4 w-4 accent-brand-600" />
            Assumir conversas novas sem responsável
          </label>
          <Field label="Confiança mínima para responder (0 a 1)" hint="Abaixo disso, transfere para humano.">
            <input name="handoffConfidence" type="number" min={0} max={1} step={0.05} defaultValue={values.handoff_confidence} className={inputClass} />
          </Field>
          <Field label="Máx. respostas automáticas por conversa">
            <input name="maxReplies" type="number" min={1} max={50} defaultValue={values.max_replies_per_conversation} className={inputClass} />
          </Field>
        </>
      )}
      {!sdr && (
        <>
          <input type="hidden" name="phoneNumberId" value="" />
          <input type="hidden" name="handoffConfidence" value={values.handoff_confidence} />
          <input type="hidden" name="maxReplies" value={values.max_replies_per_conversation} />
        </>
      )}
      <Field label="Máx. execuções por dia">
        <input name="dailyLimit" type="number" min={1} max={5000} defaultValue={values.daily_executions_limit} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" /> Salvar
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

type Version = { system_prompt: string; provider: string; model: string; max_output_tokens: number; input_price_per_mtok: number; output_price_per_mtok: number; knowledge_base_ids: string[] };

export function AgentVersionForm({ slug, agentId, values, bases, realAvailable }: { slug: string; agentId: string; values: Version; bases: Option[]; realAvailable: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(saveAgentVersion.bind(null, slug, agentId), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Instruções do agente (prompt de sistema)" className="sm:col-span-2" hint="Salvar cria uma nova versão; as anteriores ficam para voltar atrás.">
        <textarea name="prompt" required minLength={20} maxLength={12000} rows={12} defaultValue={values.system_prompt} className={`${inputClass} h-auto py-2 font-mono text-xs`} />
      </Field>
      <Field label="Provedor" hint={realAvailable ? undefined : "Sem AI_SALES_ANTHROPIC_API_KEY: só o simulado está disponível."}>
        <select name="provider" defaultValue={realAvailable ? values.provider : "mock"} className={inputClass}>
          <option value="mock">Simulado (sem custo)</option>
          <option value="anthropic" disabled={!realAvailable}>
            Anthropic (Claude)
          </option>
        </select>
      </Field>
      <Field label="Modelo">
        <input name="model" required defaultValue={values.model} className={inputClass} />
      </Field>
      <Field label="Máx. tokens de saída">
        <input name="maxOutputTokens" type="number" min={256} max={4000} defaultValue={values.max_output_tokens} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="US$/1M entrada" hint="Preço do catálogo da plataforma.">
          <input readOnly value={values.input_price_per_mtok} className={inputClass} />
        </Field>
        <Field label="US$/1M saída">
          <input readOnly value={values.output_price_per_mtok} className={inputClass} />
        </Field>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={`${labelClass} mb-2`}>Bases de conhecimento que o agente consulta</legend>
        {bases.length ? (
          <div className="flex flex-wrap gap-4">
            {bases.map((base) => (
              <label key={base.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="knowledgeBaseIds" value={base.id} defaultChecked={values.knowledge_base_ids.includes(base.id)} className="h-4 w-4 accent-brand-600" />
                {base.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma base criada (menu Conhecimento). Sem base, o agente não afirma preço, prazo nem especificação.</p>
        )}
      </fieldset>
      <Field label="Nota da versão" className="sm:col-span-2">
        <input name="notes" maxLength={500} placeholder="O que mudou" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" /> Salvar nova versão
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

function Output({ value }: { value: unknown }) {
  return <pre className="max-h-96 overflow-auto rounded-xl bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export function SdrTestConsole({ slug, agentId }: { slug: string; agentId: string }) {
  const [result, action, pending] = useActionState<AgentActionResult | null, FormData>(testSdr.bind(null, slug, agentId), null);
  return (
    <div className="grid gap-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="message" required maxLength={1000} placeholder="Ex.: Quanto custa o sistema para 3 lojas?" aria-label="Mensagem de cliente para teste" className={`${inputClass} min-w-0 flex-1`} />
        <button type="submit" className={buttonClass("secondary")} disabled={pending}>
          <FlaskConical className="h-4 w-4" aria-hidden="true" /> Testar
        </button>
      </form>
      <ResultMessage result={result} />
      {result?.output !== undefined && <Output value={result.output} />}
    </div>
  );
}

export function SupportAgentRunner({ slug, agentId, active }: { slug: string; agentId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentActionResult | null>(null);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => startTransition(async () => setResult(await runSupportAgent(slug, agentId, true)))}>
          <FlaskConical className="h-4 w-4" aria-hidden="true" /> Rodar teste (simulado)
        </button>
        <button type="button" className={buttonClass("primary")} disabled={pending || !active} onClick={() => startTransition(async () => setResult(await runSupportAgent(slug, agentId, false)))}>
          <Play className="h-4 w-4" aria-hidden="true" /> Rodar agora
        </button>
      </div>
      <ResultMessage result={result} />
      {result?.output !== undefined && <Output value={result.output} />}
    </div>
  );
}

export function KnowledgeBaseForm({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createKnowledgeBase.bind(null, slug), null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Nova base">
        <input name="name" required minLength={2} maxLength={80} placeholder="Ex.: Produtos e preços" className={inputClass} />
      </Field>
      <Field label="Descrição" className="min-w-48 flex-1">
        <input name="description" maxLength={500} className={inputClass} />
      </Field>
      <button type="submit" className={buttonClass("secondary")} disabled={pending}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Criar
      </button>
      <ResultMessage result={result} />
    </form>
  );
}

export function KnowledgeDocumentForm({ slug, bases }: { slug: string; bases: Option[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(addKnowledgeDocument.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Base">
        <select name="knowledgeBaseId" required className={inputClass}>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título">
        <input name="title" required minLength={2} maxLength={200} placeholder="Ex.: Tabela de planos 2026" className={inputClass} />
      </Field>
      <Field label="Conteúdo" className="sm:col-span-2" hint="Cole o texto (produtos, preços, prazos, FAQ, políticas). Só o que estiver aqui o agente pode afirmar.">
        <textarea name="content" rows={8} maxLength={200000} className={`${inputClass} h-auto py-2`} />
      </Field>
      <Field label="Ou envie um arquivo .txt / .md" className="sm:col-span-2">
        <input name="file" type="file" accept=".txt,.md,text/plain,text/markdown" className={`${inputClass} h-auto py-2`} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Upload className="h-4 w-4" aria-hidden="true" /> Adicionar documento
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

export function KnowledgeSearch({ slug }: { slug: string }) {
  const [result, action, pending] = useActionState<AgentActionResult | null, FormData>(searchKnowledgeTest.bind(null, slug), null);
  const rows = (result?.output as { id: string; title: string; content: string }[] | undefined) ?? [];
  return (
    <div className="grid gap-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="query" required maxLength={300} placeholder="Pergunte como um cliente perguntaria" aria-label="Pergunta de teste" className={`${inputClass} min-w-0 flex-1`} />
        <button type="submit" className={buttonClass("secondary")} disabled={pending}>
          <Search className="h-4 w-4" aria-hidden="true" /> Buscar
        </button>
      </form>
      <ResultMessage result={result} />
      <ol className="grid gap-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">{row.title}</p>
            <p className="mt-1 whitespace-pre-wrap">{row.content}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
