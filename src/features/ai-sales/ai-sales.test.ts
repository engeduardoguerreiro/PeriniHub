import { describe, expect, it } from "vitest";

import { newPasswordSchema } from "./auth/password";
import { assignableRoles, can, ORG_ROLES, PERMISSIONS, roleAtLeast } from "./auth/roles";
import { isPublicAiSalesPath, isReservedOrgSlug, isValidOrgSlug, safeNextPath, slugifyOrgName } from "./paths";
import { generateInviteToken, hashInviteToken, isInviteTokenFormat } from "./tenants/tokens";

describe("papéis", () => {
  it("segue a hierarquia viewer < sales < manager < admin < owner (mesma ordem do enum no banco)", () => {
    expect(ORG_ROLES).toEqual(["viewer", "sales", "manager", "admin", "owner"]);
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("manager", "admin")).toBe(false);
    expect(roleAtLeast("sales", "sales")).toBe(true);
    expect(roleAtLeast(null, "viewer")).toBe(false);
  });

  it("gestão de membros e configurações exige admin; ver a empresa, qualquer membro", () => {
    expect(can("viewer", "dashboard.read")).toBe(true);
    expect(can("manager", "members.manage")).toBe(false);
    expect(can("admin", "settings.manage")).toBe(true);
    expect(can("admin", "owners.manage")).toBe(false);
    expect(Object.values(PERMISSIONS).every((role) => ORG_ROLES.includes(role))).toBe(true);
  });

  it("admin atribui qualquer papel menos owner; owner atribui todos; abaixo de admin, nenhum", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).toEqual(["admin", "manager", "sales", "viewer"]);
    expect(assignableRoles("manager")).toEqual([]);
  });
});

describe("caminhos e redirecionamentos", () => {
  it("aceita só destinos internos do AI Sales", () => {
    expect(safeNextPath("/ai-sales/acme/leads")).toBe("/ai-sales/acme/leads");
    expect(safeNextPath("/ai-sales/convite/abc_DEF-123")).toBe("/ai-sales/convite/abc_DEF-123");
    for (const evil of ["//evil.com", "https://evil.com", "/ai-sales//evil.com", "/ai-sales/\\evil", "/admin", "/ai-salesx", "javascript:alert(1)", 42, null]) {
      expect(safeNextPath(evil)).toBe("/ai-sales");
    }
  });

  it("só login, recuperação, callback e convite são públicos", () => {
    expect(isPublicAiSalesPath("/ai-sales/login")).toBe(true);
    expect(isPublicAiSalesPath("/ai-sales/convite/abc")).toBe(true);
    expect(isPublicAiSalesPath("/ai-sales/auth/callback")).toBe(true);
    expect(isPublicAiSalesPath("/ai-sales/loginx")).toBe(false);
    expect(isPublicAiSalesPath("/ai-sales/acme/dashboard")).toBe(false);
    expect(isPublicAiSalesPath("/ai-sales/redefinir-senha")).toBe(false);
    expect(isPublicAiSalesPath("/ai-sales/platform")).toBe(false);
  });

  it("valida e gera identificadores de empresa como o banco", () => {
    expect(isValidOrgSlug("perini-food")).toBe(true);
    expect(isValidOrgSlug("-x")).toBe(false);
    expect(isValidOrgSlug("Perini")).toBe(false);
    expect(slugifyOrgName("Perini Engenharia & Serviços Ltda.")).toBe("perini-engenharia-servicos-ltda");
    expect(isReservedOrgSlug("platform")).toBe(true);
    expect(isReservedOrgSlug("perinifood")).toBe(false);
  });
});

describe("tokens de convite", () => {
  it("geram 43 caracteres base64url, únicos, e o hash é SHA-256 determinístico", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(isInviteTokenFormat(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(a.token)).toBe(a.hash);
    expect(isInviteTokenFormat("curto")).toBe(false);
    expect(isInviteTokenFormat(`${a.token}/../x`)).toBe(false);
  });
});

describe("senha nova", () => {
  it("exige 10 caracteres e confirmação igual", () => {
    expect(newPasswordSchema.safeParse({ password: "curta", confirm: "curta" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "senha-longa-1", confirm: "senha-longa-2" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "senha-longa-1", confirm: "senha-longa-1" }).success).toBe(true);
  });
});
