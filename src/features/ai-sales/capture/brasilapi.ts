import "server-only";

import { type CnpjData, mapBrasilApiCnpj } from "./cnpj";

// Consulta pontual de CNPJ na BrasilAPI (gratuita, sem chave). Feita só pelo
// servidor, com tempo limite; o limite de uso por empresa fica na action.

const ENDPOINT = "https://brasilapi.com.br/api/cnpj/v1/";
const TIMEOUT_MS = 8_000;

export type CnpjLookup = { status: "success"; data: CnpjData } | { status: "not_found" } | { status: "error"; message: string };

export async function lookupCnpj(cnpj: string, fetcher: typeof fetch = fetch): Promise<CnpjLookup> {
  try {
    const response = await fetcher(`${ENDPOINT}${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": "PeriniHub-AI-Sales/1.0 (+https://perinihub.com.br)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) return { status: "not_found" };
    if (!response.ok) return { status: "error", message: `BrasilAPI respondeu ${response.status}` };
    const data = mapBrasilApiCnpj(await response.json());
    return data ? { status: "success", data } : { status: "error", message: "Resposta inesperada da BrasilAPI" };
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.name === "TimeoutError" ? "BrasilAPI não respondeu a tempo" : "Falha ao consultar a BrasilAPI" };
  }
}
