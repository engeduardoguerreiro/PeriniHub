// Resultado padrão das Server Actions do AI Sales.

export type ActionResult = {
  ok: boolean;
  message: string;
  /** Link de convite: mostrado uma única vez para quem convidou. */
  inviteUrl?: string;
  /** QR Code (data URL) da conexão Evolution, quando houver. */
  qr?: string | null;
  /** Estado da conexão Evolution. */
  state?: string;
};

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

/** Códigos das funções e triggers do banco traduzidos para o usuário. */
const DB_MESSAGES: Record<string, string> = {
  not_authorized: "Sem permissão para esta ação.",
  owner_protected: "Só um proprietário pode alterar proprietários.",
  last_owner: "A empresa precisa de ao menos um proprietário ativo.",
  already_member: "Essa pessoa já faz parte da empresa.",
  organization_invites_pending_key: "Já existe um convite pendente para esse e-mail.",
  invite_invalid: "Convite inválido, expirado ou revogado.",
  invite_used: "Este convite já foi usado.",
  invite_email_mismatch: "Este convite é para outro e-mail. Entre com a conta convidada.",
  not_platform_admin: "Ação restrita ao superadmin.",
  organizations_slug_key: "Já existe uma empresa com esse identificador.",
  organizations_document_key: "Já existe uma empresa com esse CNPJ.",
  organization_not_found: "Empresa não encontrada.",
  reason_required: "Informe o motivo (mínimo 3 caracteres).",
};

export function dbMessage(message: string | undefined) {
  const code = Object.keys(DB_MESSAGES).find((key) => message?.includes(key));
  return code ? DB_MESSAGES[code] : "Não foi possível concluir. Tente novamente.";
}
