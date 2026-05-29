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
import { WHATSAPP_URL, projectTypes } from "@/lib/site";

type FormStatus = "idle" | "success" | "error";

export function ContactForm() {
  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const required = ["name", "email", "whatsapp", "message"];
    const missingField = required.some(
      (field) => !String(formData.get(field) ?? "").trim(),
    );

    if (missingField || !projectType) {
      setStatus("error");
      return;
    }

    // Placeholder preparado para futura integração com Resend, EmailJS,
    // Nodemailer, Supabase ou uma rota interna em /api/contact.
    console.info("PeriniHub contact payload", {
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      whatsapp: formData.get("whatsapp"),
      projectType,
      message: formData.get("message"),
    });

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
          <Field label="E-mail" htmlFor="email" required>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" required>
            <Input id="whatsapp" name="whatsapp" required autoComplete="tel" />
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
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              name="message"
              required
              rows={6}
              placeholder="Conte rapidamente o que você precisa construir, validar ou automatizar."
            />
          </div>
        </div>
        {status === "success" && (
          <p className="mt-5 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Mensagem registrada. A integração de envio está pronta para ser conectada.
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
          Enviar mensagem
        </Button>
      </form>

      <aside className="rounded-lg border border-zinc-200/90 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-400">
          Atendimento direto
        </p>
        <h3 className="mt-4 text-2xl font-black">Atendimento direto</h3>
        <ul className="mt-6 grid gap-4 text-sm text-zinc-200">
          {[
            "Análise inicial do projeto",
            "Sugestão de MVP",
            "Estimativa de escopo",
            "Direcionamento técnico",
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
