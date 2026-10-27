import type { Metadata } from "next";

import { requireEditor } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  const user = await requireEditor();
  return (
    <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
      Olá, {user.email}
    </h1>
  );
}
