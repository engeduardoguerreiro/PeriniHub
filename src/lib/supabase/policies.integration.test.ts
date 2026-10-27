import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./database.types";

// Integração real com o Supabase: RLS, guarda de publicação, função de
// publicação (aprovação, limite diário, idempotência, concorrência), reserva
// de orçamento e auditoria. Tudo que é criado aqui é apagado no afterAll.

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

const service: Db = createClient<Database>(url, secret, options);
const anon: Db = createClient<Database>(url, publishable, options);

const runTag = randomBytes(4).toString("hex");
const users: { id: string; email: string; password: string; client?: Db }[] = [];
const articleIds: string[] = [];
let originalSettings: Database["public"]["Tables"]["news_editorial_settings"]["Row"];

async function createUser(role: "editor" | null) {
  const email = `zz-teste-${role ?? "sem-papel"}-${runTag}@teste.perinihub.local`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role) await service.from("admin_profiles").insert({ user_id: data.user.id, role });
  const client = createClient<Database>(url, publishable, options);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  users.push({ id: data.user.id, email, password, client });
  return client;
}

async function createArticle(overrides: Partial<Database["public"]["Tables"]["news_articles"]["Insert"]> = {}) {
  const suffix = randomBytes(3).toString("hex");
  const { data, error } = await service
    .from("news_articles")
    .insert({
      slug: `zz-teste-${runTag}-${suffix}`,
      title: `[TESTE] Artigo de integração ${suffix}`,
      excerpt: "Artigo temporário criado pelos testes de integração.",
      content: "Conteúdo de teste. ".repeat(20),
      status: "draft",
      ...overrides,
    })
    .select("id, slug")
    .single();
  if (error) throw error;
  articleIds.push(data.id);
  return data;
}

let editor: Db;
let noRole: Db;

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Defina as variáveis do Supabase em .env.local");
  const { data } = await service.from("news_editorial_settings").select("*").eq("id", 1).single();
  originalSettings = data!;
  editor = await createUser("editor");
  noRole = await createUser(null);
});

afterAll(async () => {
  await service.from("news_editorial_settings").update({
    daily_publication_limit: originalSettings.daily_publication_limit,
    automation_paused: originalSettings.automation_paused,
    monthly_cost_limit: originalSettings.monthly_cost_limit,
  }).eq("id", 1);
  if (articleIds.length) await service.from("news_articles").delete().in("id", articleIds);
  await service.from("news_agent_runs").delete().like("idempotency_key", `zz-teste-${runTag}%`);
  for (const user of users) {
    await service.from("admin_profiles").delete().eq("user_id", user.id);
    await service.auth.admin.deleteUser(user.id);
  }
});

describe("RLS: rascunhos e dados editoriais não vazam", () => {
  it("público (anon) não vê rascunho, mas vê publicado", async () => {
    const draft = await createArticle();
    const published = await createArticle({ status: "approved", verification_status: "verified" });
    await service.rpc("news_publish_article", { p_article_id: published.id });

    const { data } = await anon.from("news_articles").select("id").in("id", [draft.id, published.id]);
    expect(data?.map((row) => row.id)).toEqual([published.id]);
  });

  it("usuário logado sem papel editorial também não vê rascunhos nem dados internos", async () => {
    const draft = await createArticle();
    expect((await noRole.from("news_articles").select("id").eq("id", draft.id)).data).toEqual([]);
    for (const table of ["news_sources", "news_candidates", "news_editorial_settings", "news_audit_logs", "news_agent_runs", "news_claims"] as const) {
      expect((await noRole.from(table).select("*").limit(1)).data).toEqual([]);
    }
  });

  it("ninguém de fora escreve: anon e sem-papel não alteram nem criam artigos", async () => {
    const draft = await createArticle();
    await anon.from("news_articles").update({ title: "invadido pelo anon" }).eq("id", draft.id);
    await noRole.from("news_articles").update({ title: "invadido sem papel" }).eq("id", draft.id);
    const insert = await anon.from("news_articles").insert({ slug: "zz-invasao", title: "Invasão de teste", excerpt: "x".repeat(30), content: "x".repeat(250) });
    expect(insert.error).not.toBeNull();
    const { data } = await service.from("news_articles").select("title").eq("id", draft.id).single();
    expect(data?.title).toMatch(/^\[TESTE\]/);
  });

  it("editor lê rascunhos, mas não altera configurações (só admin)", async () => {
    const draft = await createArticle();
    expect((await editor.from("news_articles").select("id").eq("id", draft.id)).data).toHaveLength(1);
    await editor.from("news_editorial_settings").update({ daily_publication_limit: 49 }).eq("id", 1);
    const { data } = await service.from("news_editorial_settings").select("daily_publication_limit").eq("id", 1).single();
    expect(data?.daily_publication_limit).toBe(originalSettings.daily_publication_limit);
  });

  it("auditoria é append-only, mesmo para editores", async () => {
    const insert = await editor.from("news_audit_logs").insert({ actor_type: "user", action: "forjado", entity_type: "x" });
    expect(insert.error).not.toBeNull();
  });
});

describe("publicação só pelas regras editoriais", () => {
  it("ninguém publica mudando o status direto (nem editor, nem serviço)", async () => {
    const article = await createArticle({ status: "approved", verification_status: "verified" });
    const byEditor = await editor.from("news_articles").update({ status: "published", published_at: new Date().toISOString() }).eq("id", article.id);
    expect(byEditor.error?.message).toContain("publish_via_function_only");
    const byService = await service.from("news_articles").update({ status: "published", published_at: new Date().toISOString() }).eq("id", article.id);
    expect(byService.error?.message).toContain("publish_via_function_only");
  });

  it("anon e sem-papel não podem chamar a função de publicação", async () => {
    const article = await createArticle({ status: "approved", verification_status: "verified" });
    expect((await anon.rpc("news_publish_article", { p_article_id: article.id })).error).not.toBeNull();
    expect((await noRole.rpc("news_publish_article", { p_article_id: article.id })).error?.message).toContain("not_authorized");
  });

  it("artigo não aprovado não é publicado", async () => {
    const article = await createArticle({ status: "needs_review", verification_status: "verified" });
    expect((await service.rpc("news_publish_article", { p_article_id: article.id })).error?.message).toContain("not_approved");
  });

  it("modo automático respeita publicação automática desligada e aprovação humana", async () => {
    const article = await createArticle({ status: "approved", verification_status: "verified" });
    const result = await service.rpc("news_publish_article", { p_article_id: article.id, p_mode: "auto" });
    expect(result.error?.message).toMatch(/auto_publish_disabled|approval_required/);
  });

  it("aprovação do editor registra quem aprovou; editor pode então publicar", async () => {
    const article = await createArticle({ status: "blocked", verification_status: "blocked" });
    await editor.from("news_articles").update({ status: "approved" }).eq("id", article.id);
    const { data } = await service.from("news_articles").select("approved_by, status").eq("id", article.id).single();
    expect(data).toMatchObject({ status: "approved", approved_by: users[0].id });
    const published = await editor.rpc("news_publish_article", { p_article_id: article.id });
    expect(published.error).toBeNull();
    expect(published.data?.status).toBe("published");
  });

  it("editar o texto de um aprovado devolve para revisão", async () => {
    const article = await createArticle({ status: "needs_review", verification_status: "verified" });
    await editor.from("news_articles").update({ status: "approved" }).eq("id", article.id);
    await editor.from("news_articles").update({ content: "Texto alterado depois da aprovação. ".repeat(10) }).eq("id", article.id);
    const { data } = await service.from("news_articles").select("status, approved_by").eq("id", article.id).single();
    expect(data).toEqual({ status: "needs_review", approved_by: null });
  });

  it("publicar de novo é idempotente (mesma data, sem duplicar)", async () => {
    const article = await createArticle({ status: "approved", verification_status: "verified" });
    const first = await service.rpc("news_publish_article", { p_article_id: article.id });
    const second = await service.rpc("news_publish_article", { p_article_id: article.id });
    expect(second.data?.published_at).toBe(first.data?.published_at);
  });

  it("limite diário vale mesmo com publicações concorrentes", async () => {
    const { count } = await service
      .from("news_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    // Deixa espaço para exatamente uma publicação a mais hoje.
    await service.from("news_editorial_settings").update({ daily_publication_limit: Math.min((count ?? 0) + 1, 50) }).eq("id", 1);
    const a = await createArticle({ status: "approved", verification_status: "verified" });
    const b = await createArticle({ status: "approved", verification_status: "verified" });
    const results = await Promise.all([a, b].map((article) => service.rpc("news_publish_article", { p_article_id: article.id })));
    const ok = results.filter((result) => !result.error);
    const limited = results.filter((result) => result.error?.message.includes("daily_limit_reached"));
    expect(ok).toHaveLength(1);
    expect(limited).toHaveLength(1);
    await service.from("news_editorial_settings").update({ daily_publication_limit: originalSettings.daily_publication_limit }).eq("id", 1);
  });
});

describe("orçamento de IA e idempotência de execuções", () => {
  it("recusa reserva que estoura o teto mensal", async () => {
    const result = await service.rpc("news_start_agent_run", {
      p_agent_name: "writer",
      p_estimated_cost: Number(originalSettings.monthly_cost_limit) + 1,
      p_idempotency_key: `zz-teste-${runTag}-budget`,
    });
    expect(result.error?.message).toContain("budget_exceeded");
  });

  it("mesma chave de idempotência não cobra duas vezes", async () => {
    const key = `zz-teste-${runTag}-dup`;
    const first = await service.rpc("news_start_agent_run", { p_agent_name: "curator", p_estimated_cost: 0, p_idempotency_key: key });
    expect(first.error).toBeNull();
    const second = await service.rpc("news_start_agent_run", { p_agent_name: "curator", p_estimated_cost: 0, p_idempotency_key: key });
    expect(second.error?.message).toContain("duplicate_run");
  });

  it("automação pausada bloqueia novas execuções", async () => {
    await service.from("news_editorial_settings").update({ automation_paused: true }).eq("id", 1);
    const result = await service.rpc("news_start_agent_run", { p_agent_name: "curator", p_estimated_cost: 0, p_idempotency_key: `zz-teste-${runTag}-paused` });
    await service.from("news_editorial_settings").update({ automation_paused: originalSettings.automation_paused }).eq("id", 1);
    expect(result.error?.message).toContain("automation_paused");
  });

  it("editor não consegue reservar orçamento nem tomar lease (só o worker)", async () => {
    expect((await editor.rpc("news_start_agent_run", { p_agent_name: "curator", p_estimated_cost: 0 })).error).not.toBeNull();
    expect((await editor.rpc("news_claim_candidate", { p_candidate_id: articleIds[0] ?? "00000000-0000-0000-0000-000000000000" })).error).not.toBeNull();
  });
});

describe("auditoria", () => {
  it("registra a aprovação com o editor como autor", async () => {
    const article = await createArticle({ status: "needs_review" });
    await editor.from("news_articles").update({ status: "approved" }).eq("id", article.id);
    const { data } = await service
      .from("news_audit_logs")
      .select("actor_id, actor_type, action")
      .eq("entity_id", article.id)
      .eq("action", "status:approved");
    expect(data?.[0]).toMatchObject({ actor_id: users[0].id, actor_type: "user" });
  });
});
