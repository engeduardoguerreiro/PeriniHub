import type { Database } from "@/lib/supabase/sales.types";

// Papéis por empresa e a matriz de permissões do app. As mesmas regras estão
// nas policies e funções do banco (supabase-sales/): o app decide o que
// mostrar e recusa cedo; o banco é a barreira final.

export type OrgRole = Database["public"]["Enums"]["org_role"];

/** Mesma ordem do enum org_role no banco (a comparação >= depende dela). */
export const ORG_ROLES = ["viewer", "sales", "manager", "admin", "owner"] as const satisfies readonly OrgRole[];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  sales: "Vendedor",
  viewer: "Leitura",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Tudo na empresa, inclusive outros proprietários.",
  admin: "Membros, integrações, agentes e configurações.",
  manager: "CRM completo, aprovação de campanhas e relatórios.",
  sales: "Leads, contatos, inbox e tarefas.",
  viewer: "Somente leitura.",
};

export function roleAtLeast(role: OrgRole | null | undefined, min: OrgRole) {
  if (!role) return false;
  return ORG_ROLES.indexOf(role) >= ORG_ROLES.indexOf(min);
}

/** Papel mínimo de cada ação. Espelhado nas policies (teste de integração). */
export const PERMISSIONS = {
  "dashboard.read": "viewer",
  "members.read": "viewer",
  "members.manage": "admin",
  "invites.manage": "admin",
  "owners.manage": "owner",
  "settings.read": "viewer",
  "settings.manage": "admin",
  "organization.update": "admin",
  "billing.read": "admin",
  "audit.read": "admin",
} as const satisfies Record<string, OrgRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: OrgRole | null | undefined, permission: Permission) {
  return roleAtLeast(role, PERMISSIONS[permission]);
}

/** Papéis que alguém com `actor` pode atribuir (convite ou alteração). */
export function assignableRoles(actor: OrgRole | null | undefined): OrgRole[] {
  if (!can(actor, "members.manage")) return [];
  return actor === "owner" ? [...ORG_ROLES].reverse() : ORG_ROLES.filter((role) => role !== "owner").reverse();
}
