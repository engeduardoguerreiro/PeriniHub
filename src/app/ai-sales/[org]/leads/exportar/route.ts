import { NextResponse, type NextRequest } from "next/server";

import { findMembership } from "@/features/ai-sales/auth/dal";
import { toCsv } from "@/features/ai-sales/crm/csv";
import { QUALIFICATION_LABELS } from "@/features/ai-sales/crm/labels";
import { searchTerm } from "@/features/ai-sales/crm/queries";
import { createSalesSessionClient } from "@/lib/supabase/sales-server";

// Exportação de leads em CSV: só gestor ou acima, com os filtros da lista,
// até 10.000 linhas e registro na auditoria (quem, quando, quantas, filtros).
const MAX_ROWS = 10_000;
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(request: NextRequest, { params }: RouteContext<"/ai-sales/[org]/leads/exportar">) {
  const { org } = await params;
  const membership = await findMembership(org, "manager");
  if (!membership) return new NextResponse("Não encontrado", { status: 404 });

  const search = request.nextUrl.searchParams;
  const q = searchTerm(search.get("q"));
  const stage = UUID.test(search.get("etapa") ?? "") ? search.get("etapa")! : "";
  const source = UUID.test(search.get("origem") ?? "") ? search.get("origem")! : "";
  const owner = search.get("responsavel") === "none" ? "none" : UUID.test(search.get("responsavel") ?? "") ? search.get("responsavel")! : "";
  const qualification = (search.get("interesse") ?? "") in QUALIFICATION_LABELS ? (search.get("interesse") as keyof typeof QUALIFICATION_LABELS) : "";

  const db = await createSalesSessionClient();
  let query = db
    .from("leads")
    .select("id, title, qualification, score, created_at, stage:pipeline_stages(name), source:lead_sources(name), contact:contacts!inner(full_name, phone_e164, email, job_title, city, state), company:companies(name, document)")
    .eq("tenant_id", membership.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (q) query = query.or(`full_name.ilike.%${q}%,email_normalized.ilike.%${q}%,phone_e164.ilike.%${q}%`, { referencedTable: "contacts" });
  if (stage) query = query.eq("stage_id", stage);
  if (source) query = query.eq("lead_source_id", source);
  if (owner === "none") query = query.is("owner_user_id", null);
  else if (owner) query = query.eq("owner_user_id", owner);
  if (qualification) query = query.eq("qualification", qualification);

  const { data, error } = await query;
  if (error) return new NextResponse("Falha ao exportar", { status: 500 });
  const audit = await db.rpc("record_export", {
    p_tenant: membership.tenantId,
    p_entity: "leads",
    p_rows: data.length,
    p_filters: { q, stage, source, owner, qualification },
  });
  if (audit.error) return new NextResponse("Exportação não autorizada", { status: 403 });

  const csv = toCsv(
    ["Nome", "Telefone", "E-mail", "Cargo", "Cidade", "UF", "Empresa", "CNPJ", "Título", "Etapa", "Origem", "Interesse", "Pontuação", "Criado em"],
    data.map((lead) => [
      lead.contact?.full_name,
      lead.contact?.phone_e164,
      lead.contact?.email,
      lead.contact?.job_title,
      lead.contact?.city,
      lead.contact?.state,
      lead.company?.name,
      lead.company?.document,
      lead.title,
      lead.stage?.name,
      lead.source?.name,
      QUALIFICATION_LABELS[lead.qualification],
      lead.score,
      new Date(lead.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${org}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
