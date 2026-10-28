import type { Metadata } from "next";

import { AuthCard } from "@/components/ai-sales/auth-card";
import { RecoverForm } from "@/components/ai-sales/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPage() {
  return (
    <AuthCard title="Recuperar senha" description="Enviaremos um link para você criar uma nova senha.">
      <RecoverForm />
    </AuthCard>
  );
}
