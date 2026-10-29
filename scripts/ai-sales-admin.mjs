// Administração do Supabase "AI Sales" pela linha de comando.
// Uso (carrega o .env.local):
//   set -a && . ./.env.local && set +a && node scripts/ai-sales-admin.mjs bootstrap contato@perinihub.com.br
//
// bootstrap <email>: cria a conta (se não existir) com senha aleatória que
// ninguém vê e a torna superadmin. A senha é definida pelo próprio dono em
// /ai-sales/recuperar-senha. Nenhum segredo é impresso.
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const [command, rawEmail] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SALES_SUPABASE_URL;
const secret = process.env.SALES_SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error("Defina NEXT_PUBLIC_SALES_SUPABASE_URL e SALES_SUPABASE_SECRET_KEY (carregue o .env.local).");
  process.exit(1);
}
if (command !== "bootstrap" || !rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
  console.error("Uso: node scripts/ai-sales-admin.mjs bootstrap <email>");
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

let user = await findUser();
if (user) {
  console.log(`Conta já existe: ${email}`);
} else {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
  console.log(`Conta criada: ${email} (defina a senha em /ai-sales/recuperar-senha)`);
}

const profile = await db.from("user_profiles").upsert({ user_id: user.id, email }, { onConflict: "user_id" });
if (profile.error) throw profile.error;
const admin = await db
  .from("platform_admins")
  .upsert({ user_id: user.id, note: "bootstrap via scripts/ai-sales-admin.mjs" }, { onConflict: "user_id", ignoreDuplicates: true });
if (admin.error) throw admin.error;
console.log("Superadmin da plataforma: ok");
