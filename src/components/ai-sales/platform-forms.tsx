"use client";

import { Building2, Send } from "lucide-react";
import { useActionState, useState } from "react";

import { createOrganization, reissueOwnerInvite } from "@/app/ai-sales/platform/actions";
import type { ActionResult } from "@/features/ai-sales/action-result";
import { slugifyOrgName } from "@/features/ai-sales/paths";

import { buttonClass } from "./button-styles";
import { InviteLink, ResultMessage } from "./buttons";
import { inputClass, labelClass } from "./ui";

function Result({ result }: { result: ActionResult | null }) {
  if (result?.ok && result.inviteUrl) {
    return (
      <div className="grid gap-2">
        <ResultMessage result={result} />
        <InviteLink url={result.inviteUrl} />
      </div>
    );
  }
  return <ResultMessage result={result} />;
}

export function CreateOrganizationForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createOrganization, null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className={labelClass}>Nome comercial</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          onChange={(event) => !slugTouched && setSlug(slugifyOrgName(event.target.value))}
          className={inputClass}
        />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Identificador na URL</span>
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9\-]{1,46}[a-z0-9]"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value.toLowerCase());
          }}
          aria-describedby="slug-ajuda"
          className={inputClass}
        />
        <span id="slug-ajuda" className="text-xs text-muted-foreground">
          /ai-sales/{slug || "identificador"}/dashboard
        </span>
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Razão social (opcional)</span>
        <input name="legalName" maxLength={200} className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>CNPJ (opcional)</span>
        <input name="document" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className={inputClass} />
      </label>
      <label className="grid gap-1.5 sm:col-span-2">
        <span className={labelClass}>E-mail do proprietário</span>
        <input name="ownerEmail" type="email" required maxLength={254} className={inputClass} />
        <span className="text-xs text-muted-foreground">Recebe um convite de proprietário (válido por 7 dias). Plano: Interno, sem cobrança.</span>
      </label>
      <div className="grid gap-3 sm:col-span-2">
        <div>
          <button type="submit" className={buttonClass("primary")} disabled={pending}>
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {pending ? "Criando…" : "Criar empresa"}
          </button>
        </div>
        <Result result={result} />
      </div>
    </form>
  );
}

export function ReissueOwnerInviteForm({ tenantId }: { tenantId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(reissueOwnerInvite.bind(null, tenantId), null);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input name="email" type="email" required maxLength={254} placeholder="e-mail do proprietário" aria-label="E-mail do proprietário" className={`${inputClass} h-9 min-w-0 flex-1`} />
        <button type="submit" className={buttonClass("secondary")} disabled={pending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Novo convite
        </button>
      </div>
      <Result result={result} />
    </form>
  );
}
