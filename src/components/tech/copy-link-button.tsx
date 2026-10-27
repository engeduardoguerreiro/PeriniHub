"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard: o link continua visível na barra do navegador.
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copiado" : "Copiar link"}</span>
    </button>
  );
}
