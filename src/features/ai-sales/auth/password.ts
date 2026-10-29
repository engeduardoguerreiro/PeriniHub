import { z } from "zod";

// Regra de senha do AI Sales (o Supabase Auth do projeto exige no mínimo 6;
// aqui subimos para 10). Usada na redefinição e na criação de conta por convite.

export const MIN_PASSWORD_LENGTH = 10;

export const newPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`).max(200),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
