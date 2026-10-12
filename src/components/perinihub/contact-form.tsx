"use client";

import { CheckCircle2, ChevronDown, ExternalLink, Send, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildQuoteUrl,
  fieldErrors,
  MESSAGE_MAX_LENGTH,
  QUOTE_FIELDS,
  type QuoteField,
  validateQuote,
} from "@/lib/quote";
import { projectTypes, WHATSAPP_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const fieldLabels: Record<QuoteField, string> = {
  name: "Nome",
  whatsapp: "WhatsApp",
  projectType: "Tipo de projeto",
  message: "O que você precisa",
};

export function ContactForm() {
  const [invalid, setInvalid] = useState<QuoteField[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // URL do WhatsApp gerada no último envio válido. Fica visível como link porque
  // window.open com noopener não informa se o popup foi bloqueado.
  const [quoteUrl, setQuoteUrl] = useState<string | null>(null);

  const errorProps = (field: QuoteField) =>
    invalid.includes(field)
      ? { "aria-invalid": true, "aria-describedby": `${field}-error` }
      : {};

  function clearError(field: QuoteField) {
    if (invalid.includes(field)) setInvalid(invalid.filter((item) => item !== field));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      name: String(data.get("name") ?? ""),
      company: String(data.get("company") ?? ""),
      whatsapp: String(data.get("whatsapp") ?? ""),
      projectType: String(data.get("projectType") ?? ""),
      message: String(data.get("message") ?? ""),
    };

    const errors = validateQuote(input);
    setInvalid(errors);
    setSubmitted(true);

    if (errors.length > 0) {
      setQuoteUrl(null);
      // Leva o foco ao primeiro campo pendente para quem navega por teclado.
      const first = QUOTE_FIELDS.find((field) => errors.includes(field));
      form.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }

    const url = buildQuoteUrl(input);
    setQuoteUrl(url);
    window.open(url, "_blank", "noopener");
  }

  const hasErrors = submitted && invalid.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-ink-900/8 bg-white p-5 shadow-[0_20px_60px_-30px_rgb(8_24_56/0.25)] sm:p-8"
        noValidate
      >
        <p className="mb-5 text-sm text-ink-900/65">
          Campos com <span aria-hidden="true">*</span> são obrigatórios.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name" required error={invalid.includes("name")}>
            <Input
              id="name"
              name="name"
              required
              autoComplete="name"
              className="h-11"
              onChange={() => clearError("name")}
              {...errorProps("name")}
            />
          </Field>
          <Field label="Empresa" htmlFor="company">
            <Input id="company" name="company" autoComplete="organization" className="h-11" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" required error={invalid.includes("whatsapp")}>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              maxLength={20}
              className="h-11"
              placeholder="(11) 90000-0000"
              onChange={() => clearError("whatsapp")}
              {...errorProps("whatsapp")}
            />
          </Field>
          <Field
            label="Tipo de projeto"
            htmlFor="projectType"
            required
            error={invalid.includes("projectType")}
            className="sm:col-span-2"
          >
            {/* <select> nativo: melhor no celular e sem JS extra de dropdown. */}
            <div className="relative">
              <select
                id="projectType"
                name="projectType"
                required
                defaultValue=""
                onChange={() => clearError("projectType")}
                className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent pl-2.5 pr-9 text-base text-ink-900 outline-none transition-colors invalid:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
                {...errorProps("projectType")}
              >
                <option value="" disabled>
                  Selecione uma opção
                </option>
                {projectTypes.map((type) => (
                  <option key={type} value={type} className="text-ink-900">
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/50"
                aria-hidden="true"
              />
            </div>
          </Field>
          <Field
            label="O que você precisa?"
            htmlFor="message"
            required
            error={invalid.includes("message")}
            className="sm:col-span-2"
          >
            <Textarea
              id="message"
              name="message"
              required
              rows={5}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="Ex.: preciso de um site para minha empresa, ou de um sistema para controlar pedidos."
              onChange={() => clearError("message")}
              {...errorProps("message")}
            />
          </Field>
        </div>

        {/* Região sempre montada para que leitores de tela anunciem cada novo resultado. */}
        <div role="alert" aria-live="assertive" className="empty:hidden">
          {hasErrors && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Faltam: {invalid.map((field) => fieldLabels[field]).join(", ")}.
            </p>
          )}
        </div>
        <div role="status" className="empty:hidden">
          {quoteUrl && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="flex items-start gap-2 font-medium">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Tudo certo! Abrimos o WhatsApp com seus dados, é só tocar em enviar.
              </p>
              <a
                href={quoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-sm pl-6 font-semibold text-emerald-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                O WhatsApp não abriu? Toque aqui
                <span className="sr-only"> (abre em nova aba)</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-6 h-12 w-full rounded-full bg-brand-600 px-6 text-base text-white hover:bg-brand-700 sm:w-auto"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Solicitar orçamento
        </Button>
        <p className="mt-3 text-xs text-ink-900/65">
          Ao enviar, abrimos uma conversa no WhatsApp com os dados preenchidos. Eles não ficam
          salvos no site.
        </p>
      </form>

      <aside className="relative isolate overflow-hidden rounded-2xl bg-ink-900 p-6 text-white sm:p-8">
        <span className="hero-glow absolute inset-0 -z-10 opacity-80" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua-300">
          Sem compromisso
        </p>
        <h3 className="font-display mt-4 text-2xl font-semibold">O que você recebe</h3>
        <ul className="mt-6 grid gap-4 text-sm text-white/80">
          {[
            "Retorno em até 24 horas",
            "Análise gratuita do que você precisa",
            "Escopo e prazo por escrito",
            "Orçamento fechado, sem surpresa",
          ].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-aqua-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <Button asChild className="mt-8 h-11 w-full rounded-full bg-white text-ink-900 hover:bg-brand-50">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </Button>
      </aside>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: QuoteField | "company";
  required?: boolean;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && htmlFor !== "company" && (
        <p id={`${htmlFor}-error`} className="text-sm text-red-700">
          {fieldErrors[htmlFor]}
        </p>
      )}
    </div>
  );
}
