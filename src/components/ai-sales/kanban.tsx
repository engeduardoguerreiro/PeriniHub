"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { updateLead } from "@/app/ai-sales/[org]/crm-actions";
import { QUALIFICATION_LABELS, STAGE_COLORS, type StageColor } from "@/features/ai-sales/crm/labels";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; color: string; total: number };
type Card = {
  id: string;
  stageId: string;
  name: string;
  company: string | null;
  title: string | null;
  qualification: keyof typeof QUALIFICATION_LABELS;
  score: number | null;
  owner: string | null;
};

// Kanban sem biblioteca: arrastar e soltar nativo para mouse e, para teclado
// e leitores de tela, um seletor de etapa em cada cartão. A mudança aparece na
// hora (otimista) e é desfeita se o servidor recusar.
export function KanbanBoard({ slug, stages, cards, readOnly }: { slug: string; stages: Stage[]; cards: Card[]; readOnly: boolean }) {
  const [optimistic, move] = useOptimistic(cards, (state, { id, stageId }: { id: string; stageId: string }) =>
    state.map((card) => (card.id === id ? { ...card, stageId } : card)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function moveCard(id: string, stageId: string) {
    const card = optimistic.find((item) => item.id === id);
    if (!card || card.stageId === stageId) return;
    setError(null);
    startTransition(async () => {
      move({ id, stageId });
      const result = await updateLead(slug, id, { stageId });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="grid gap-3">
      <div role="status" aria-live="polite" className="text-sm text-red-700 empty:hidden dark:text-red-300">
        {error}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageCards = optimistic.filter((card) => card.stageId === stage.id);
          const hidden = stage.total - cards.filter((card) => card.stageId === stage.id).length;
          return (
            <section
              key={stage.id}
              aria-label={`${stage.name}: ${stageCards.length} lead(s)`}
              onDragOver={(event) => {
                if (readOnly || !dragging) return;
                event.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                if (dragging) moveCard(dragging, stage.id);
                setDragging(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/40 transition-colors",
                over === stage.id && "border-primary bg-primary/5",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_COLORS[stage.color as StageColor] ?? STAGE_COLORS.slate)} aria-hidden="true" />
                  {stage.name}
                </h2>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{stageCards.length + Math.max(0, hidden)}</span>
              </header>
              <ul className="grid min-h-24 content-start gap-2 p-2">
                {stageCards.map((card) => (
                  <li
                    key={card.id}
                    draggable={!readOnly}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(card.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn("rounded-xl border border-border bg-card p-3 text-sm shadow-sm", !readOnly && "cursor-grab active:cursor-grabbing", dragging === card.id && "opacity-50")}
                  >
                    <Link href={`/ai-sales/${slug}/leads/${card.id}`} className="font-medium hover:text-primary hover:underline">
                      {card.name}
                    </Link>
                    {(card.company || card.title) && <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.title || card.company}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {QUALIFICATION_LABELS[card.qualification]}
                      {card.score != null && ` · ${card.score}`}
                      {card.owner && ` · ${card.owner}`}
                    </p>
                    {!readOnly && (
                      <select
                        aria-label={`Mover ${card.name} para outra etapa`}
                        value={card.stageId}
                        onChange={(event) => moveCard(card.id, event.target.value)}
                        className="mt-2 h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs"
                      >
                        {stages.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
                {hidden > 0 && <li className="px-1 text-xs text-muted-foreground">+{hidden} mais antigos (veja na lista de leads)</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
