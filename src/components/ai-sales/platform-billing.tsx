"use client";

import { BadgeDollarSign, Building2, ClipboardList, HeartPulse, Layers, Save } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";

import { createInvoice, setInvoiceStatus, updateSubscription, upsertPlan } from "@/app/ai-sales/platform/billing-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { METRIC_LABELS, PLAN_METRICS } from "@/features/ai-sales/billing/limits";
import { cn } from "@/lib/utils";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

const NAV = [
  { href: "/ai-sales/platform", label: "Empresas", icon: Building2, exact: true },
  { href: "/ai-sales/platform/planos", label: "Planos", icon: Layers },
  { href: "/ai-sales/platform/saude", label: "Saúde das integrações", icon: HeartPulse },
  { href: "/ai-sales/platform/auditoria", label: "Auditoria", icon: ClipboardList },
];

export function PlatformNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Plataforma" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href || pathname.startsWith(`${href}/empresas`) : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ReasonField() {
  return (
    <Field label="Motivo (vai para a auditoria)" className="sm:col-span-2">
      <input name="reason" required minLength={3} maxLength={500} className={inputClass} />
    </Field>
  );
}

function LimitFields({ values, placeholder }: { values: Record<string, number | undefined>; placeholder: string }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border p-4 sm:col-span-2 sm:grid-cols-2">
      {PLAN_METRICS.map((metric) => (
        <Field key={metric} label={METRIC_LABELS[metric]}>
          <input name={`limit_${metric}`} inputMode="decimal" defaultValue={values[metric] ?? ""} placeholder={placeholder} className={inputClass} />
        </Field>
      ))}
    </div>
  );
}

function Submit({ pending, label, result }: { pending: boolean; label: string; result: ActionResult | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
      <button type="submit" className={buttonClass("primary")} disabled={pending}>
        <Save className="h-4 w-4" aria-hidden="true" /> {label}
      </button>
      <ResultMessage result={result} />
    </div>
  );
}

export type PlanValues = {
  code: string;
  name: string;
  description: string | null;
  limits: Record<string, number>;
  priceCents: number | null;
  priceIsFinal: boolean;
  isPublic: boolean;
  active: boolean;
};

const centsToInput = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function PlanForm({ values }: { values?: PlanValues }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(upsertPlan, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Código" hint={values ? "Não muda depois de criado." : "Ex.: starter, pro."}>
        <input name="code" required pattern="[a-z0-9_]{2,40}" defaultValue={values?.code} readOnly={Boolean(values)} className={inputClass} />
      </Field>
      <Field label="Nome">
        <input name="name" required minLength={2} maxLength={80} defaultValue={values?.name} className={inputClass} />
      </Field>
      <Field label="Descrição" className="sm:col-span-2">
        <input name="description" maxLength={500} defaultValue={values?.description ?? ""} className={inputClass} />
      </Field>
      <Field label="Preço mensal (R$)" hint="Vazio = a definir. Sem a marcação abaixo, aparece como provisório.">
        <input name="price" inputMode="decimal" placeholder="199,90" defaultValue={centsToInput(values?.priceCents ?? null)} className={inputClass} />
      </Field>
      <div className="grid content-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="priceIsFinal" defaultChecked={values?.priceIsFinal} className="h-4 w-4 accent-brand-600" /> Preço definitivo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPublic" defaultChecked={values?.isPublic} className="h-4 w-4 accent-brand-600" /> Plano público
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={values?.active ?? true} className="h-4 w-4 accent-brand-600" /> Ativo
        </label>
      </div>
      <LimitFields values={values?.limits ?? {}} placeholder="vazio = não incluído" />
      <ReasonField />
      <Submit pending={pending} label={values ? "Salvar plano" : "Criar plano"} result={result} />
    </form>
  );
}

export type SubscriptionValues = {
  planCode: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  overrides: Record<string, number>;
  notes: string | null;
};

const STATUS_OPTIONS = [
  ["internal", "Interno (sem cobrança)"],
  ["trial", "Teste"],
  ["active", "Ativa"],
  ["past_due", "Em atraso (bloqueia recursos)"],
  ["canceled", "Cancelada (bloqueia recursos)"],
] as const;

export function SubscriptionForm({ tenantId, values, plans }: { tenantId: string; values: SubscriptionValues; plans: { code: string; name: string }[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateSubscription.bind(null, tenantId), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Plano">
        <select name="planCode" defaultValue={values.planCode} className={inputClass}>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={values.status} className={inputClass}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Início do período">
        <input name="periodStart" type="date" defaultValue={values.periodStart ?? ""} className={inputClass} />
      </Field>
      <Field label="Fim do período">
        <input name="periodEnd" type="date" defaultValue={values.periodEnd ?? ""} className={inputClass} />
      </Field>
      <p className="text-sm font-semibold sm:col-span-2">Limites específicos desta empresa (vazio = usa o do plano)</p>
      <LimitFields values={values.overrides} placeholder="do plano" />
      <Field label="Observações" className="sm:col-span-2">
        <input name="notes" maxLength={1000} defaultValue={values.notes ?? ""} className={inputClass} />
      </Field>
      <ReasonField />
      <Submit pending={pending} label="Salvar assinatura" result={result} />
    </form>
  );
}

export function InvoiceForm({ tenantId }: { tenantId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createInvoice.bind(null, tenantId), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Descrição" className="sm:col-span-2">
        <input name="description" required minLength={3} maxLength={300} placeholder="Mensalidade AI Sales — novembro/2026" className={inputClass} />
      </Field>
      <Field label="Valor (R$)">
        <input name="amount" required inputMode="decimal" placeholder="199,90" className={inputClass} />
      </Field>
      <Field label="Vencimento">
        <input name="dueDate" type="date" required className={inputClass} />
      </Field>
      <Field label="Período: início">
        <input name="periodStart" type="date" className={inputClass} />
      </Field>
      <Field label="Período: fim">
        <input name="periodEnd" type="date" className={inputClass} />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <input name="notes" maxLength={1000} className={inputClass} />
      </Field>
      <ReasonField />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> Criar rascunho
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

/** Registrar pagamento: forma de pagamento + motivo. */
export function PayInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => setInvoiceStatus(invoiceId, "paid", String(formData.get("method") ?? ""), String(formData.get("reason") ?? "")),
    null,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <select name="method" aria-label="Forma de pagamento" className={`${inputClass} w-auto`}>
        <option value="PIX">PIX</option>
        <option value="Boleto">Boleto</option>
        <option value="Transferência">Transferência</option>
        <option value="Cartão">Cartão</option>
      </select>
      <input name="reason" required minLength={3} maxLength={500} aria-label="Motivo" placeholder="Motivo (ex.: comprovante recebido)" className={`${inputClass} w-56`} />
      <button type="submit" className={buttonClass("secondary")} disabled={pending}>
        Registrar pagamento
      </button>
      <ResultMessage result={result} />
    </form>
  );
}
