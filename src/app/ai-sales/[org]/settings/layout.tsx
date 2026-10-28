import { Suspense } from "react";

import { SettingsTabs, SettingsTabsList } from "@/components/ai-sales/settings-tabs";
import { PageHeading } from "@/components/ai-sales/ui";

async function Tabs({ params }: { params: LayoutProps<"/ai-sales/[org]/settings">["params"] }) {
  const { org } = await params;
  return (
    <Suspense fallback={<SettingsTabsList slug={org} />}>
      <SettingsTabs slug={org} />
    </Suspense>
  );
}

export default function SettingsLayout({ children, params }: LayoutProps<"/ai-sales/[org]/settings">) {
  return (
    <>
      <PageHeading title="Configurações" description="Membros, dados da empresa e histórico de alterações." />
      <Suspense fallback={<div className="mb-6 h-10" />}>
        <Tabs params={params} />
      </Suspense>
      {children}
    </>
  );
}
