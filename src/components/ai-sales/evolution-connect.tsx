"use client";

import { LoaderCircle, QrCode, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { connectEvolution, evolutionConnectionStatus, setEvolutionDailyLimit } from "@/app/ai-sales/[org]/whatsapp-actions";
import type { ActionResult } from "@/features/ai-sales/action-result";

import { buttonClass } from "./button-styles";
import { ResultMessage } from "./buttons";
import { inputClass } from "./ui";

/** Conexão Evolution: mostra o QR Code e acompanha a leitura a cada 3 s. */
export function EvolutionConnect({ slug, connected }: { slug: string; connected: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(async () => {
      const status = await evolutionConnectionStatus(slug);
      if (status.state === "open") {
        setQr(null);
        setResult(status);
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [qr, slug, router]);

  return (
    <div className="grid gap-4">
      <button
        type="button"
        className={buttonClass(connected ? "secondary" : "primary")}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const response = await connectEvolution(slug);
            setResult(response);
            setQr(response.qr ?? null);
          })
        }
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <QrCode className="h-4 w-4" aria-hidden="true" />}
        {connected ? "Reconectar (novo QR Code)" : "Gerar QR Code"}
      </button>
      {qr && (
        <figure className="grid justify-items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada na hora pelo servidor Evolution */}
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code para conectar o WhatsApp" width={256} height={256} className="rounded-xl border border-border bg-white p-2" />
          <figcaption className="text-xs text-muted-foreground">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O QR Code expira em cerca de 1 minuto; gere outro se precisar.</figcaption>
        </figure>
      )}
      <ResultMessage result={result} />
    </div>
  );
}

export function EvolutionDailyLimit({ slug, value }: { slug: string; value: number }) {
  const [limit, setLimit] = useState(String(value));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Mensagens proativas por dia (máx. 30)
        <input type="number" min={0} max={30} value={limit} onChange={(event) => setLimit(event.target.value)} className={`${inputClass} w-28`} />
      </label>
      <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => startTransition(async () => setResult(await setEvolutionDailyLimit(slug, Number(limit))))}>
        <Save className="h-4 w-4" aria-hidden="true" /> Salvar
      </button>
      <ResultMessage result={result} />
    </div>
  );
}
