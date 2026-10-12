import { ArrowUpRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type FeatureCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
};

export function FeatureCard({ title, description, icon: Icon, className }: FeatureCardProps) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border border-ink-900/8 bg-white p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_40px_-18px_rgb(8_24_56/0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition-colors duration-300 group-hover:bg-gradient-brand group-hover:text-white group-hover:ring-transparent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="font-display mt-5 text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-ink-900/65 sm:text-[15px] sm:leading-7">
        {description}
      </p>
    </article>
  );
}

type ProductCardProps = {
  name: string;
  description: string;
  highlights: string[];
  href?: string;
  icon: LucideIcon;
};

export function ProductCard({ name, description, highlights, href, icon: Icon }: ProductCardProps) {
  const live = Boolean(href);

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-6 sm:p-8",
        live ? "ring-gradient border-transparent bg-white/[0.06]" : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl text-white",
            live ? "bg-gradient-brand" : "bg-white/10",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            live ? "bg-aqua-400/15 text-aqua-300" : "bg-white/8 text-white/70",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-aqua-400" : "bg-white/40")}
            aria-hidden="true"
          />
          {live ? "Em operação" : "Em desenvolvimento"}
        </span>
      </div>
      <h3 className="font-display mt-6 text-2xl font-semibold tracking-tight text-white">{name}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-white/70 sm:text-[15px] sm:leading-7">{description}</p>
      <ul className="mt-5 grid gap-2 text-sm text-white/80">
        {highlights.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-aqua-400" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="group mt-7 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-brand-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          Conhecer o {name}
          <span className="sr-only"> (abre em nova aba)</span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      ) : (
        <p className="mt-7 text-sm font-medium text-white/60">Lançamento em breve</p>
      )}
    </article>
  );
}

type ClientCardProps = {
  name: string;
  segment: string;
  description: string;
  link?: { label: string; href: string };
  icon: LucideIcon;
};

export function ClientCard({ name, segment, description, link, icon: Icon }: ClientCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-ink-900/8 bg-white p-6 sm:p-7">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink-900">{name}</h3>
          <p className="text-sm text-brand-700">{segment}</p>
        </div>
      </div>
      <p className="mt-5 flex-1 text-sm leading-6 text-ink-900/65 sm:text-[15px] sm:leading-7">{description}</p>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener"
          className="group mt-6 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {link.label}
          <span className="sr-only"> de {name} (abre em nova aba)</span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      )}
    </article>
  );
}

type ProcessStepProps = {
  title: string;
  description: string;
  index: number;
};

export function ProcessStep({ title, description, index }: ProcessStepProps) {
  return (
    <li className="relative flex gap-5 lg:flex-col lg:gap-0">
      <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white font-display text-base font-semibold text-brand-600 shadow-[0_0_0_6px_var(--background),0_6px_20px_-6px_rgb(22_119_255/0.5)] ring-1 ring-brand-200">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="pb-10 lg:pb-0 lg:pr-6 lg:pt-6">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-900/65">{description}</p>
      </div>
    </li>
  );
}
