"use client";

import { Save, Send } from "lucide-react";
import { useActionState, useTransition, useState } from "react";

import { changeMemberRole, inviteMember, updateOrganization } from "@/app/ai-sales/[org]/settings/actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type OrgRole } from "@/features/ai-sales/auth/roles";
import { SALES_VISIBILITY_LABELS, TIMEZONES } from "@/features/ai-sales/tenants/settings";

import { buttonClass } from "./button-styles";
import { InviteLink, ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

export function InviteForm({ slug, roles }: { slug: string; roles: OrgRole[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(inviteMember.bind(null, slug), null);
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="grid gap-1.5">
          <span className={labelClass}>E-mail</span>
          <input name="email" type="email" required maxLength={254} autoComplete="off" className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Papel</span>
          <select name="role" defaultValue={roles.includes("sales") ? "sales" : roles[0]} className={inputClass}>
            {roles.map((role) => (
              <option key={role} value={role} title={ROLE_DESCRIPTIONS[role]}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("primary")} disabled={pending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? "Gerando…" : "Gerar convite"}
        </button>
      </form>
      {result?.ok && result.inviteUrl ? <InviteLink url={result.inviteUrl} /> : <ResultMessage result={result} />}
    </div>
  );
}

export function RoleSelect({ slug, userId, role, roles, label }: { slug: string; userId: string; role: OrgRole; roles: OrgRole[]; label: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        aria-label={label}
        defaultValue={role}
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(async () => setResult(await changeMemberRole(slug, userId, value)));
        }}
        className={`${inputClass} h-8 w-auto py-0`}
      >
        {roles.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </select>
      {result && !result.ok && <ResultMessage result={result} />}
    </span>
  );
}

type OrgValues = { name: string; legalName: string | null; timezone: string; salesVisibility: "all" | "assigned" };

export function OrganizationForm({ slug, values, readOnly }: { slug: string; values: OrgValues; readOnly: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateOrganization.bind(null, slug), null);
  return (
    <form action={action} className="grid gap-5">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={labelClass}>Nome comercial</span>
          <input name="name" required minLength={2} maxLength={120} defaultValue={values.name} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Razão social</span>
          <input name="legalName" maxLength={200} defaultValue={values.legalName ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Fuso horário</span>
          <select name="timezone" defaultValue={values.timezone} className={inputClass}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace("America/", "").replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Visibilidade dos vendedores</span>
          <select name="salesVisibility" defaultValue={values.salesVisibility} className={inputClass}>
            {Object.entries(SALES_VISIBILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass("primary")} disabled={pending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar
          </button>
          <ResultMessage result={result} />
        </div>
      )}
    </form>
  );
}
