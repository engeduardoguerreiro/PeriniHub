import { Bot, ChartNoAxesCombined, Globe2, LayoutDashboard, MessageCircle, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/perinihub/brand";

type Node = {
  label: string;
  detail: string;
  icon: LucideIcon;
  /** Posição do centro do nó, em % do painel. */
  x: number;
  y: number;
};

const nodes: Node[] = [
  { label: "Perini Food", detail: "Delivery e iFood", icon: UtensilsCrossed, x: 22, y: 16 },
  { label: "Perini One", detail: "ERP online", icon: LayoutDashboard, x: 78, y: 16 },
  { label: "Sites", detail: "Landing pages", icon: Globe2, x: 15, y: 52 },
  { label: "WhatsApp", detail: "Atendimento", icon: MessageCircle, x: 85, y: 52 },
  { label: "Painéis", detail: "Indicadores", icon: ChartNoAxesCombined, x: 22, y: 86 },
  { label: "Automações", detail: "Integrações e APIs", icon: Bot, x: 78, y: 86 },
];

const CENTER = { x: 50, y: 52 };

/**
 * Diagrama decorativo do hero: o símbolo da PeriniHub como hub central,
 * conectado aos produtos e serviços. É puramente ilustrativo (aria-hidden),
 * pois o mesmo conteúdo aparece em texto nas seções da página.
 */
export function HubDiagram() {
  return (
    <div
      className="relative aspect-[10/9] w-full rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_-30px_rgb(22_119_255/0.45)] backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-3xl grid-lines-dark" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hub-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3d93ff" />
            <stop offset="100%" stopColor="#22e3d8" />
          </linearGradient>
        </defs>
        {nodes.map((node) => {
          const path = `M ${CENTER.x} ${CENTER.y} C ${CENTER.x} ${node.y}, ${node.x} ${CENTER.y}, ${node.x} ${node.y}`;
          return (
            <g key={node.label}>
              <path
                d={path}
                fill="none"
                stroke="rgb(125 182 255 / 0.18)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={path}
                fill="none"
                stroke="url(#hub-line)"
                strokeWidth="1.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="flow-dash"
              />
            </g>
          );
        })}
      </svg>

      {/* Hub central */}
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
      >
        <span className="node-pulse absolute h-40 w-40 rounded-full bg-brand-500/20 blur-2xl" />
        <span className="absolute h-32 w-32 rounded-full border border-brand-300/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/15 bg-ink-900/90 shadow-[0_0_0_8px_rgb(8_24_56/0.6)] lg:h-28 lg:w-28">
          <BrandMark className="w-14 lg:w-16" />
        </div>
      </div>

      {nodes.map(({ label, detail, icon: Icon, x, y }) => (
        <div
          key={label}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-xl border border-white/10 bg-ink-900/85 py-2 pl-2 pr-3.5 shadow-lg shadow-black/20 backdrop-blur"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white">
            <Icon className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block whitespace-nowrap text-[13px] font-semibold text-white">{label}</span>
            <span className="block whitespace-nowrap text-[11px] text-white/55">{detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
