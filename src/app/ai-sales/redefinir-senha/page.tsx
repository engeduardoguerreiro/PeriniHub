import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard, FormFallback } from "@/components/ai-sales/auth-card";
import { ResetPasswordForm } from "@/components/ai-sales/auth-forms";
import { requireSalesUser } from "@/features/ai-sales/auth/dal";

export const metadata: Metadata = { title: "Nova senha" };

async function Gate() {
  const user = await requireSalesUser();
  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">Conta: {user.email}</p>
      <ResetPasswordForm />
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Criar nova senha">
      <Suspense fallback={<FormFallback />}>
        <Gate />
      </Suspense>
    </AuthCard>
  );
}
