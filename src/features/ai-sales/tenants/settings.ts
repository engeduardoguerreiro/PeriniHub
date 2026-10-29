// Opções de configuração da empresa (fusos do Brasil e visibilidade de leads).

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Recife",
  "America/Fortaleza",
  "America/Bahia",
  "America/Belem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

export const SALES_VISIBILITY_LABELS = {
  all: "Vendedores veem todos os leads da empresa",
  assigned: "Vendedores veem só os leads atribuídos a eles",
} as const;
