import { redirect } from "next/navigation";
import { Suspense } from "react";

async function Redirect({ params }: Pick<PageProps<"/ai-sales/[org]/settings">, "params">) {
  const { org } = await params;
  redirect(`/ai-sales/${org}/settings/membros`);
  return null;
}

export default function SettingsIndex({ params }: PageProps<"/ai-sales/[org]/settings">) {
  return (
    <Suspense>
      <Redirect params={params} />
    </Suspense>
  );
}
