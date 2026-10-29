import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { SettingsForm } from "@/components/admin/forms";
import { Empty, formatDateTimeShort, PageHeading, Panel } from "@/components/admin/ui";
import { requireEditor } from "@/lib/auth/admin";
import { createSessionClient } from "@/lib/supabase/server";

import { setCategoryEnabled } from "../actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireEditor();
  const db = await createSessionClient();
  const [{ data: settings }, { data: categories }] = await Promise.all([
    db.from("news_editorial_settings").select("*").eq("id", 1).single(),
    db.from("news_categories").select("id, name, slug, enabled").order("sort_order"),
  ]);
  if (!settings) return <Empty>Configurações indisponíveis.</Empty>;

  if (user.role !== "admin") {
    return (
      <>
        <PageHeading title="Configurações" description="Somente administradores alteram a política editorial." />
        <Panel title="Política atual">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-900/55">Aprovação humana</dt><dd>{settings.approval_required ? "Obrigatória" : "Dispensada"}</dd></div>
            <div><dt className="text-ink-900/55">Publicação automática</dt><dd>{settings.auto_publish_enabled ? "Ligada" : "Desligada"}</dd></div>
            <div><dt className="text-ink-900/55">Limite diário</dt><dd>{settings.daily_publication_limit}</dd></div>
            <div><dt className="text-ink-900/55">Coleta</dt><dd>{settings.schedule_weekdays.map((day) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][day]).join(", ")} · {settings.schedule_times.join(", ")}</dd></div>
          </dl>
        </Panel>
      </>
    );
  }

  const enabledCategories = (categories ?? []).filter((category) => category.enabled);

  return (
    <>
      <PageHeading
        title="Configurações"
        description={`Política editorial e automação. Última alteração: ${formatDateTimeShort(settings.updated_at)}.`}
      />
      <Panel title="Política editorial" className="mb-6">
        <SettingsForm
          settings={{ ...settings, monthly_cost_limit: Number(settings.monthly_cost_limit) }}
          categories={enabledCategories.map(({ id, name }) => ({ id, name }))}
        />
      </Panel>
      <Panel title="Categorias do portal" description="Categorias desativadas deixam de ser usadas pela curadoria.">
        <ul className="divide-y divide-ink-900/6">
          {(categories ?? []).map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className={category.enabled ? "text-ink-900" : "text-ink-900/50"}>
                {category.name}
              </span>
              <ActionButton
                action={setCategoryEnabled.bind(null, category.id, !category.enabled)}
                confirm={
                  category.enabled
                    ? {
                        title: `Desativar ${category.name}`,
                        description: "A curadoria deixa de usá-la para novas matérias. Artigos já publicados continuam no portal.",
                        confirmLabel: "Desativar",
                      }
                    : undefined
                }
              >
                {category.enabled ? "Desativar" : "Ativar"}
              </ActionButton>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
