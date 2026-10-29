import type { Database } from "@/lib/supabase/sales.types";

type Enums = Database["public"]["Enums"];

export const QUALIFICATION_LABELS: Record<Enums["lead_qualification"], string> = {
  unknown: "Não avaliado",
  cold: "Frio",
  warm: "Morno",
  hot: "Quente",
};

export const DISCOVERY_LABELS: Record<Enums["discovery_stage"], string> = {
  company_identified: "Empresa identificada",
  contact_found: "Contato encontrado",
  contact_authorized: "Contato autorizado",
  qualified_opportunity: "Oportunidade qualificada",
};

export const CHANNEL_LABELS: Record<Enums["consent_channel"], string> = { whatsapp: "WhatsApp", email: "E-mail", phone: "Telefone" };

export const PURPOSE_LABELS: Record<Enums["consent_purpose"], string> = {
  marketing: "Marketing e ofertas",
  sales_followup: "Acompanhamento comercial",
  service: "Atendimento",
  transactional: "Avisos transacionais",
};

export const LEGAL_BASIS_LABELS: Record<Enums["legal_basis"], string> = {
  consent: "Consentimento",
  legitimate_interest: "Legítimo interesse",
  contract: "Execução de contrato",
  legal_obligation: "Obrigação legal",
};

export const SUPPRESSION_LABELS: Record<Enums["suppression_reason"], string> = {
  opt_out: "Pediu para não receber",
  complaint: "Reclamação",
  blocked: "Bloqueou o número",
  invalid: "Contato inválido",
  legal_request: "Pedido do titular (LGPD)",
};

export const ACTIVITY_LABELS: Record<Enums["activity_kind"], string> = {
  note: "Nota",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  message: "Mensagem",
  stage_change: "Etapa",
  consent_change: "Consentimento",
  task: "Tarefa",
  import: "Importação",
  system: "Sistema",
};

export const OPPORTUNITY_LABELS: Record<Enums["opportunity_status"], string> = { open: "Aberta", won: "Ganha", lost: "Perdida" };

export type StageColor = "slate" | "blue" | "cyan" | "violet" | "amber" | "emerald" | "red";

export const STAGE_COLORS: Record<StageColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-brand-500",
  cyan: "bg-aqua-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
};

export const STAGE_COLOR_NAMES: Record<StageColor, string> = {
  slate: "Cinza",
  blue: "Azul",
  cyan: "Ciano",
  violet: "Violeta",
  amber: "Âmbar",
  emerald: "Verde",
  red: "Vermelho",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatCents(cents: number | null | undefined) {
  return cents == null ? "—" : brl.format(cents / 100);
}
