import { z } from "zod";

// Variáveis lidas sob demanda (não no import): o build do site institucional
// e o CI rodam sem as credenciais do portal, e a home precisa continuar
// renderizando sem notícias nesse caso.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().regex(/^https:\/\/[a-z0-9]+\.supabase\.co$/),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = { supabaseUrl: string; supabaseKey: string };

/** Credenciais públicas do Supabase, ou null quando o portal não está configurado. */
export function getPublicEnv(): PublicEnv | null {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) return null;
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requirePublicEnv(): PublicEnv {
  const env = getPublicEnv();
  if (!env) throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return env;
}

// --- PeriniHub AI Sales (projeto Supabase próprio) ---------------------------

/** Flag geral do AI Sales: desligado, /ai-sales responde 404 e nada roda. */
export function isAiSalesEnabled() {
  return process.env.AI_SALES_ENABLED === "true";
}

/** Exige segundo fator (AAL2) no painel de plataforma. Desligado por decisão (D-16). */
export function isPlatformMfaRequired() {
  return process.env.AI_SALES_PLATFORM_REQUIRE_MFA === "true";
}

/** WhatsApp: "mock" (padrão) libera o modo simulado; "live" só conexões reais. */
export function whatsappMode(): "mock" | "live" {
  return process.env.WHATSAPP_MODE === "live" ? "live" : "mock";
}

const salesPublicSchema = z.object({
  NEXT_PUBLIC_SALES_SUPABASE_URL: z.url().regex(/^https:\/\/[a-z0-9]+\.supabase\.co$/),
  NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

/** Credenciais públicas do Supabase do AI Sales, ou null quando não configurado. */
export function getSalesPublicEnv(): PublicEnv | null {
  const parsed = salesPublicSchema.safeParse({
    NEXT_PUBLIC_SALES_SUPABASE_URL: process.env.NEXT_PUBLIC_SALES_SUPABASE_URL,
    NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) return null;
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SALES_SUPABASE_URL,
    supabaseKey: parsed.data.NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requireSalesPublicEnv(): PublicEnv {
  const env = getSalesPublicEnv();
  if (!env) {
    throw new Error("AI Sales sem Supabase: defina NEXT_PUBLIC_SALES_SUPABASE_URL e NEXT_PUBLIC_SALES_SUPABASE_PUBLISHABLE_KEY.");
  }
  return env;
}

const secretSchemas = {
  SUPABASE_SECRET_KEY: z.string().min(20),
  SALES_SUPABASE_SECRET_KEY: z.string().min(20),
  WHATSAPP_APP_SECRET: z.string().regex(/^[0-9a-f]{32}$/, "App Secret do app da Meta (32 hex)"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(32),
  // Servidor Evolution API (o mesmo do PeriniFood), conexão não oficial (D-17).
  EVOLUTION_API_URL: z.url().regex(/^https:\/\//, "use https"),
  EVOLUTION_API_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "64 hex (openssl rand -hex 32)"),
  EVOLUTION_WEBHOOK_SECRET: z.string().min(32),
  TRIGGER_SECRET_KEY: z.string().regex(/^tr_(dev|stg|prod|preview)_/),
  NEWS_REVALIDATE_SECRET: z.string().regex(/^[0-9a-f]{64}$/, "use openssl rand -hex 32"),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  AI_SALES_ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  NEWS_SITE_URL: z.url(),
} as const;

type SecretName = keyof typeof secretSchemas;

/**
 * Lê um segredo validado. A mensagem de erro cita só o nome da variável,
 * nunca o valor, para não vazar credenciais em logs.
 */
export function requireSecret<K extends SecretName>(name: K): z.infer<(typeof secretSchemas)[K]> {
  const parsed = secretSchemas[name].safeParse(process.env[name]);
  if (!parsed.success) throw new Error(`Variável de ambiente ausente ou inválida: ${name}`);
  return parsed.data as z.infer<(typeof secretSchemas)[K]>;
}
