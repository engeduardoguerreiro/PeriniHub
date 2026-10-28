import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard, FormFallback } from "@/components/ai-sales/auth-card";
import { CreateAccountForm } from "@/components/ai-sales/auth-forms";
import { buttonClass } from "@/components/ai-sales/button-styles";
import { ActionButton } from "@/components/ai-sales/buttons";
import { Notice } from "@/components/ai-sales/ui";
import { getSalesUser } from "@/features/ai-sales/auth/dal";
import { ROLE_LABELS } from "@/features/ai-sales/auth/roles";
import { hashInviteToken, isInviteTokenFormat } from "@/features/ai-sales/tenants/tokens";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Convite" };

async function InviteGate({ params }: Pick<PageProps<"/ai-sales/convite/[token]">, "params">) {
  const { token } = await params;
  const invite = isInviteTokenFormat(token)
    ? (await createSalesServiceClient().rpc("get_invite_preview", { p_token_hash: hashInviteToken(token) })).data?.[0]
    : undefined;
  if (!invite) {
    return <Notice tone="warning">Convite inválido, expirado ou já usado. Peça um novo a quem convidou você.</Notice>;
  }

  const user = await getSalesUser();
  const summary = (
    <p className="mb-5 text-sm text-muted-foreground">
      Você foi convidado para <strong className="text-foreground">{invite.organization_name}</strong> como{" "}
      <strong className="text-foreground">{ROLE_LABELS[invite.role]}</strong>.
    </p>
  );

  if (user) {
    if (user.email?.toLowerCase() !== invite.email) {
      return (
        <>
          {summary}
          <Notice tone="warning">
            Este convite é para {invite.email}, mas você entrou como {user.email}. Saia e entre com a conta convidada.
          </Notice>
        </>
      );
    }
    return (
      <>
        {summary}
        <ActionButton action={acceptInvite.bind(null, token)} variant="primary">
          Aceitar convite
        </ActionButton>
      </>
    );
  }

  return (
    <>
      {summary}
      <CreateAccountForm token={token} email={invite.email} />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={`/ai-sales/login?next=${encodeURIComponent(`/ai-sales/convite/${token}`)}`} className={`${buttonClass("secondary")} mt-2 w-full`}>
          Entrar e aceitar
        </Link>
      </p>
    </>
  );
}

export default function InvitePage({ params }: PageProps<"/ai-sales/convite/[token]">) {
  return (
    <AuthCard title="Convite para o AI Sales">
      <Suspense fallback={<FormFallback />}>
        <InviteGate params={params} />
      </Suspense>
    </AuthCard>
  );
}
