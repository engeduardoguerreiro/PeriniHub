import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/ai-sales/buttons";
import { CaptureFormEditor, CopyBlock } from "@/components/ai-sales/capture";
import { PageFallback } from "@/components/ai-sales/page-fallback";
import { Empty, formatDateTime, Notice, Panel, StatusBadge } from "@/components/ai-sales/ui";
import { requireMember } from "@/features/ai-sales/auth/dal";
import { roleAtLeast } from "@/features/ai-sales/auth/roles";
import { FORM_FIELD_LABELS } from "@/features/ai-sales/capture/constants";
import { FORM_STATUS } from "@/features/ai-sales/capture/labels";
import { getCaptureForm } from "@/features/ai-sales/capture/queries";
import { CHANNEL_LABELS, PURPOSE_LABELS } from "@/features/ai-sales/crm/labels";
import { loadCrmOptions } from "@/features/ai-sales/crm/queries";
import { requestOrigin } from "@/features/ai-sales/origin";
import { orgPath } from "@/features/ai-sales/paths";

import { setCaptureFormStatus } from "../../capture-actions";

export const metadata: Metadata = { title: "Formulário" };

/** HTML para colar em outro site: POST nativo para a rota pública (volta para a página do formulário). */
function embedSnippet(action: string, version: number, consentText: string, fields: string[]) {
  const inputs = fields
    .filter((field) => field !== "message")
    .map((field) => `  <label>${FORM_FIELD_LABELS[field as keyof typeof FORM_FIELD_LABELS]} <input name="${field}"${field === "email" ? ' type="email"' : field === "phone" ? ' type="tel"' : ""}></label>`);
  if (fields.includes("message")) inputs.push('  <label>Mensagem <textarea name="message"></textarea></label>');
  const consent = consentText.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] ?? char);
  return [
    `<form action="${action}" method="post">`,
    `  <input type="hidden" name="consent_version" value="${version}">`,
    '  <div style="position:absolute;left:-9999px" aria-hidden="true"><input name="site_empresa" tabindex="-1" autocomplete="off"></div>',
    '  <label>Nome <input name="full_name" required></label>',
    ...inputs,
    `  <label><input type="checkbox" name="consent" value="on"> ${consent}</label>`,
    '  <button type="submit">Enviar</button>',
    "</form>",
  ].join("\n");
}

async function FormContent({ params }: Pick<PageProps<"/ai-sales/[org]/capture/[id]">, "params">) {
  const { org, id } = await params;
  const membership = await requireMember(org);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [detail, crm, origin] = await Promise.all([getCaptureForm(membership.tenantId, id), loadCrmOptions(membership.tenantId), requestOrigin()]);
  if (!detail) notFound();
  const { form, versions, submissions, consentedCount } = detail;
  const manager = roleAtLeast(membership.role, "manager");
  const publicUrl = `${origin}/ai-sales/f/${form.public_key}`;
  const status = FORM_STATUS[form.status];

  return (
    <>
      <Link href={orgPath(org, "capture")} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Captação
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{form.name}</h1>
        <StatusBadge status={status.tone} label={status.label} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-6">
          <Panel
            title="Publicação"
            actions={
              manager &&
              (form.status === "active" ? (
                <ActionButton action={setCaptureFormStatus.bind(null, org, form.id, "paused")}>Pausar</ActionButton>
              ) : (
                <ActionButton variant="primary" action={setCaptureFormStatus.bind(null, org, form.id, "active")}>
                  Publicar
                </ActionButton>
              ))
            }
          >
            <div className="grid gap-4">
              {form.status !== "active" && <Notice tone="warning">O link só aceita envios com o formulário publicado.</Notice>}
              <CopyBlock label="Link público" value={publicUrl} />
              <CopyBlock
                label="Código para incorporar em outro site"
                value={embedSnippet(`${origin}/api/ai-sales/forms/${form.public_key}`, form.consent_version, form.consent_text, form.fields)}
                multiline
              />
              <p className="text-xs text-muted-foreground">
                O código usa a versão {form.consent_version} da autorização. Se o texto mudar, atualize o código: envios com versão antiga são recusados.
              </p>
            </div>
          </Panel>
          <Panel title="Configuração" description={manager ? undefined : "Só gestores alteram formulários."}>
            <CaptureFormEditor
              slug={org}
              formId={form.id}
              readOnly={!manager}
              sources={crm.sources.filter((source) => source.active)}
              values={{
                name: form.name,
                headline: form.headline,
                description: form.description,
                fields: form.fields,
                consentText: form.consent_text,
                channels: form.consent_channels,
                purposes: form.consent_purposes,
                successMessage: form.success_message,
                sourceId: form.lead_source_id,
              }}
            />
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel title="Envios" description={`${form.submissions_count} no total · ${consentedCount} com autorização.`}>
            {submissions.length ? (
              <ul className="divide-y divide-border text-sm">
                {submissions.map((submission) => (
                  <li key={submission.id} className="py-2">
                    {submission.contact ? (
                      <Link href={orgPath(org, `contacts/${submission.contact.id}`)} className="font-medium hover:text-primary hover:underline">
                        {submission.contact.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Contato removido</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(submission.created_at)} · {submission.consent_given ? `autorizou (v${submission.consent_version})` : "sem autorização"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum envio.</Empty>
            )}
          </Panel>
          <Panel title="Versões da autorização" description="Texto exato que cada titular viu. Não pode ser editado.">
            <ol className="grid gap-3 text-sm">
              {versions.map((version) => (
                <li key={version.version} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    v{version.version} · {formatDateTime(version.created_at)} · {version.consent_channels.map((channel) => CHANNEL_LABELS[channel]).join(", ")} ·{" "}
                    {version.consent_purposes.map((purpose) => PURPOSE_LABELS[purpose]).join(", ")}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{version.consent_text}</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={version.text_hash}>
                    sha256 {version.text_hash}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function CaptureFormPage({ params }: PageProps<"/ai-sales/[org]/capture/[id]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FormContent params={params} />
    </Suspense>
  );
}
