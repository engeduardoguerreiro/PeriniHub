"use client";

import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WHATSAPP_URL, buildWhatsAppUrl, projectTypes } from "@/lib/site";

type FormStatus = "idle" | "success" | "error";

export function ContactForm() {
  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const invalid = (field: string) => missing.has(field) || undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const required = ["name", "whatsapp", "message"];
    const missingFields = new Set(
      required.filter((field) => !String(formData.get(field) ?? "").trim()),
    );
    if (!projectType) missingFields.add("projectType");
    setMissing(missingFields);

    if (missingFields.size > 0) {
      setStatus("error");
      // Leva o foco ao primeiro campo pendente para quem navega por teclado.
      const first = [...required, "projectType"].find((field) => missingFields.has(field));
      form.querySelector<HTMLElement>(`[name="${first}"], #${first}`)?.focus();
      return;
    }

    const company = String(formData.get("company") ?? "").trim();
    const lines = [
      "Olá! Vim pelo site da PeriniHub e gostaria de um orçamento.",
      "",
      `Nome: ${formData.get("name")}`,
      company ? `Empresa: ${company}` : null,
      `WhatsApp: ${formData.get("whatsapp")}`,
      `Tipo de projeto: ${projectType}`,
      "",
      `Sobre o projeto: ${formData.get("message")}`,
    ].filter(Boolean);

    window.open(buildWhatsAppUrl(lines.join("\n")), "_blank", "noopener");

    setStatus("success");
    setMissing(new Set());
    form.reset();
    setProjectType("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-ink-900/8 bg-white p-5 shadow-[0_20px_60px_-30px_rgb(8_24_56/0.25)] sm:p-8"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name" required>
            <Input id="name" name="name" required autoComplete="name" className="h-11" aria-invalid={invalid("name")} />
          </Field>
          <Field label="Empresa" htmlFor="company">
            <Input id="company" name="company" autoComplete="organization" className="h-11" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" required>
            <Input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              className="h-11"
              aria-invalid={invalid("whatsapp")}
              placeholder="(11) 90000-0000"
            />
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="projectType">Tipo de projeto *</Label>
            <Select
              value={projectType}
              onValueChange={(value) => setProjectType(value ?? "")}
              required
            >
              <SelectTrigger id="projectType" aria-label="Tipo de projeto" aria-invalid={invalid("projectType")} className="w-full data-[size=default]:h-11">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="message">O que você precisa? *</Label>
            <Textarea
              id="message"
              name="message"
              required
              rows={5}
              aria-invalid={invalid("message")}
              placeholder="Ex.: preciso de um site para minha empresa, ou de um sistema para controlar pedidos."
            />
          </div>
        </div>
        {status === "success" && (
          <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Abrimos o WhatsApp com seus dados. É só tocar em enviar para falar com a gente.
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            Preencha os campos obrigatórios antes de enviar.
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-full bg-brand-500 px-6 text-base text-white hover:bg-brand-600 sm:w-auto">
          <Send className="h-4 w-4" aria-hidden="true" />
          Solicitar orçamento
        </Button>
        <p className="mt-3 text-xs text-ink-900/60">
          Ao enviar, abrimos uma conversa no WhatsApp com seus dados preenchidos.
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
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
