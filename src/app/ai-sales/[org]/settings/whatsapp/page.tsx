import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { EvolutionConnect, EvolutionDailyLimit } from "@/components/ai-sales/evolution-connect";
import { ManualConnectForm } from "@/components/ai-sales/inbox";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { templateBody } from "@/features/ai-sales/whatsapp/templates";
import { evolutionConfigured } from "@/features/ai-sales/whatsapp/evolution";
import { whatsappMode } from "@/lib/env";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

import { connectSandbox, disconnectAccount, syncTemplates } from "../../whatsapp-actions";

export const metadata: Metadata = { title: "WhatsApp" };

async function WhatsAppSettingsContent({ params }: Pick<PageProps<"/ai-sales/[org]/settings/whatsapp">, "params">) {
  const { org } = await params;
  const membership = await requireMember(org);
  const admin = roleAtLeast(membership.role, "admin");
  const db = await createSalesSessionClient();
  const [{ data: accounts }, { data: templates }, { data: settings }] = await Promise.all([
    db
      .from("whatsapp_accounts")
      .select("id, provider, waba_id, display_name, status, coexistence, token_last4, connected_at, last_error, whatsapp_phone_numbers(id, display_phone, verified_name, quality_rating, status)")
      .eq("tenant_id", membership.tenantId)
      .order("created_at", { ascending: false }),
    db.from("whatsapp_templates").select("id, account_id, name, language, category, status, components").eq("tenant_id", membership.tenantId).order("name"),
    db.from("organization_settings").select("evolution_daily_proactive_limit").eq("tenant_id", membership.tenantId).maybeSingle(),
  ]);
  const active = (accounts ?? []).filter((account) => account.status !== "disconnected");
  const mode = whatsappMode();
  const evolution = active.find((account) => account.provider === "evolution");

  return (
    <div className="grid gap-6">
      {mode === "mock" && <Notice>Ambiente com modo simulado disponível: nenhuma mensagem do simulador sai para a Meta.</Notice>}

      <Panel title="Números conectados" description="API oficial da Meta (Cloud API) e, por decisão da empresa, conexão não oficial pela Evolution com limites rígidos.">
        {!active.length ? (
          <Empty>Nenhum número conectado. A inbox e os envios ficam desativados até a conexão.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((account) => (
              <li key={account.id} className="grid gap-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {account.provider === "sandbox" ? "WhatsApp simulado" : account.display_name ?? "WhatsApp"}
                      {account.provider === "evolution" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">não oficial</span>}
                      <StatusBadge status={account.status === "active" ? "active" : "pending"} label={account.status === "active" ? "Ativo" : account.status} />
                      {account.coexistence && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">coexistência</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.whatsapp_phone_numbers.map((number) => number.display_phone).join(", ")}
                      {account.waba_id && ` · WABA ${account.waba_id}`}
                      {account.token_last4 && ` · token ••••${account.token_last4}`}
                      {account.connected_at && ` · conectado em ${formatDateTime(account.connected_at)}`}
                      {account.whatsapp_phone_numbers[0]?.quality_rating && ` · qualidade ${account.whatsapp_phone_numbers[0].quality_rating}`}
                    </p>
                  </div>
                  {admin && (
                    <div className="flex flex-wrap gap-2">
                      {account.provider !== "evolution" && <ActionButton action={syncTemplates.bind(null, org, account.id)}>Sincronizar templates</ActionButton>}
                      <ActionButton
                        variant="danger"
                        action={disconnectAccount.bind(null, org, account.id)}
                        confirm={{
                          title: "Desconectar este número?",
                          description: account.coexistence
                            ? "A plataforma para de receber e enviar. Em coexistência, para desligar de vez, desconecte também pelo app WhatsApp Business (Configurações da conta)."
                            : "A plataforma para de receber e enviar por este número. O histórico continua.",
                          confirmLabel: "Desconectar",
                          reason: true,
                        }}
                      >
                        Desconectar
                      </ActionButton>
                    </div>
                  )}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {(templates ?? [])
                    .filter((template) => template.account_id === account.id)
                    .map((template) => (
                      <li key={template.id} title={templateBody(template.components)} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {template.name} · {template.language} · {template.category} · {template.status.toLowerCase()}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {admin && (
        <>
          <Panel title="Conectar com QR Code (coexistência oficial)" description="O número continua no app WhatsApp Business do celular e passa a funcionar na plataforma.">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                Depende do cadastro incorporado da Meta (Embedded Signup), que exige o app da PeriniHub aprovado como provedor ou um parceiro oficial.
                Enquanto isso não estiver configurado, use o modo simulado ou a conexão manual abaixo.
              </p>
            </div>
            <button type="button" disabled className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold opacity-50">
              <QrCode className="h-4 w-4" aria-hidden="true" /> Conectar por QR Code (não configurado)
            </button>
          </Panel>

          <Panel title="Conectar por QR Code — Evolution (não oficial)" description="Mesmo servidor usado pelo PeriniFood. Conexão tipo WhatsApp Web: pode levar ao banimento do número.">
            <div className="grid gap-4">
              <Notice tone="warning">
                Não é a API oficial e viola os termos do WhatsApp. Por isso, neste número: respostas a quem escreveu funcionam normalmente; para quem não
                escreveu, só envio manual, com consentimento, no máximo 2 por contato por semana e poucos por dia. Campanhas e follow-up automáticos ficam
                bloqueados. Não conecte o mesmo número pela Evolution e pela coexistência oficial ao mesmo tempo.
              </Notice>
              {evolutionConfigured() ? (
                <EvolutionConnect slug={org} connected={Boolean(evolution && evolution.status === "active")} />
              ) : (
                <p className="text-sm text-muted-foreground">Servidor Evolution não configurado neste ambiente (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_WEBHOOK_SECRET).</p>
              )}
              <EvolutionDailyLimit slug={org} value={settings?.evolution_daily_proactive_limit ?? 10} />
            </div>
          </Panel>

          <Panel title="Conexão manual (Cloud API)" description="Para o número de teste da Meta ou uma WABA já configurada no Meta Business.">
            <ManualConnectForm slug={org} />
          </Panel>

          {mode === "mock" && !active.some((account) => account.provider === "sandbox") && (
            <Panel title="Modo simulado" description="Cria um número fictício para testar a inbox, o descadastro e os bloqueios do envio sem contatos reais.">
              <ActionButton action={connectSandbox.bind(null, org)}>Ativar modo simulado</ActionButton>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default function WhatsAppSettingsPage({ params }: PageProps<"/ai-sales/[org]/settings/whatsapp">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WhatsAppSettingsContent params={params} />
    </Suspense>
  );
}
