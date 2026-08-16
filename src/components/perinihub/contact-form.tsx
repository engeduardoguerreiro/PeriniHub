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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const required = ["name", "whatsapp", "message"];
    const missingField = required.some(
      (field) => !String(formData.get(field) ?? "").trim(),
    );

    if (missingField || !projectType) {
      setStatus("error");
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
    form.reset();
    setProjectType("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-zinc-200/90 bg-white/86 p-5 shadow-sm backdrop-blur sm:p-7"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name" required>
            <Input id="name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Empresa" htmlFor="company">
            <Input id="company" name="company" autoComplete="organization" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" required>
            <Input
              id="whatsapp"
              name="whatsapp"
              required
              autoComplete="tel"
              placeholder="(11) 90000-0000"
            />
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Tipo de projeto *</Label>
            <Select
              value={projectType}
              onValueChange={(value) => setProjectType(value ?? "")}
              required
            >
              <SelectTrigger aria-label="Selecionar tipo de projeto">
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
              placeholder="Ex.: preciso de um site para minha empresa, ou de um sistema para controlar pedidos."
            />
          </div>
        </div>
        {status === "success" && (
          <p className="mt-5 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Abrimos o WhatsApp com seus dados. É só tocar em enviar para falar com a gente.
          </p>
        )}
        {status === "error" && (
          <p className="mt-5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            Preencha os campos obrigatórios antes de enviar.
          </p>
        )}
        <Button type="submit" className="mt-6 w-full bg-red-600 hover:bg-red-700 sm:w-auto">
          <Send className="h-4 w-4" aria-hidden="true" />
          Solicitar orçamento
        </Button>
        <p className="mt-3 text-xs text-zinc-500">
          Ao enviar, abrimos uma conversa no WhatsApp com seus dados preenchidos.
        </p>
      </form>

      <aside className="rounded-lg border border-zinc-200/90 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-400">
          Sem compromisso
        </p>
        <h3 className="mt-4 text-2xl font-black">O que você recebe</h3>
        <ul className="mt-6 grid gap-4 text-sm text-zinc-200">
          {[
            "Retorno em até 24 horas",
            "Análise gratuita do que você precisa",
            "Escopo e prazo por escrito",
            "Orçamento fechado, sem surpresa",
          ].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-red-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <Button asChild className="mt-8 w-full bg-white text-zinc-950 hover:bg-red-50">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
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
