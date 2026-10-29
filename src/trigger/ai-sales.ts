import { logger, schedules } from "@trigger.dev/sdk";

import { dispatchDueCampaigns, runFollowupRules } from "@/features/ai-sales/campaigns/dispatch";
import { processEvents } from "@/features/ai-sales/whatsapp/processor";
import { getSalesPublicEnv, isAiSalesEnabled } from "@/lib/env";
import { createSalesServiceClient } from "@/lib/supabase/sales-service";

// Tarefas agendadas do AI Sales no mesmo worker do portal (D-03). Enquanto o
// AI Sales não estiver ligado e configurado no worker, cada tarefa sai sem
// fazer nada — o deploy do portal não passa a gerar erros.
//
// Uma execução por vez em cada tarefa: os lotes nunca se sobrepõem.

function ready() {
  return isAiSalesEnabled() && getSalesPublicEnv() !== null && Boolean(process.env.SALES_SUPABASE_SECRET_KEY);
}

/** Reprocessa eventos do WhatsApp que falharam ou ficaram pendentes (5 tentativas → dead letter). */
export const aiSalesReprocessEvents = schedules.task({
  id: "ai-sales-reprocess-events",
  cron: "*/10 * * * *",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  run: async () => {
    if (!ready()) return { skipped: "AI Sales desligado ou sem configuração no worker" };
    const processed = await processEvents(undefined, 100);
    logger.info("eventos reprocessados", { processed });
    return { processed };
  },
});

/** Próximo lote de cada campanha agendada ou em andamento. */
export const aiSalesCampaignTick = schedules.task({
  id: "ai-sales-campaign-tick",
  cron: "*/10 * * * *",
  queue: { concurrencyLimit: 1 },
  maxDuration: 600,
  run: async () => {
    if (!ready()) return { skipped: "AI Sales desligado ou sem configuração no worker" };
    const results = await dispatchDueCampaigns();
    logger.info("campanhas", { results });
    return { campaigns: results.length };
  },
});

/** Follow-up automático pelas regras ativas de cada empresa. */
export const aiSalesFollowupTick = schedules.task({
  id: "ai-sales-followup-tick",
  cron: { pattern: "15 9-18 * * 1-5", timezone: "America/Sao_Paulo" },
  queue: { concurrencyLimit: 1 },
  maxDuration: 600,
  run: async () => {
    if (!ready()) return { skipped: "AI Sales desligado ou sem configuração no worker" };
    const summary = await runFollowupRules();
    logger.info("follow-up", { summary });
    return { rules: summary.length };
  },
});

/** Retenção de dados operacionais (prazos em retention_policies), em lotes até esgotar. */
export const aiSalesRetention = schedules.task({
  id: "ai-sales-retention",
  cron: { pattern: "30 3 * * *", timezone: "America/Sao_Paulo" },
  queue: { concurrencyLimit: 1 },
  maxDuration: 600,
  run: async () => {
    if (!ready()) return { skipped: "AI Sales desligado ou sem configuração no worker" };
    const db = createSalesServiceClient();
    const totals: Record<string, number> = {};
    // Até 20 lotes por dia: o resto fica para a próxima execução.
    for (let round = 0; round < 20; round++) {
      const { data, error } = await db.rpc("apply_retention", { p_batch: 1000 });
      if (error) throw new Error(`retenção falhou: ${error.message}`);
      const counts = data as Record<string, number>;
      for (const [key, value] of Object.entries(counts)) totals[key] = (totals[key] ?? 0) + value;
      if (Object.values(counts).every((value) => value === 0)) break;
    }
    logger.info("retenção", { totals });
    return totals;
  },
});
