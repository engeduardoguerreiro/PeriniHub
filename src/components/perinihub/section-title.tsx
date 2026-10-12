import { cn } from "@/lib/utils";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  /** Usa h1 quando o título é o principal da página. */
  as?: "h1" | "h2";
};

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  tone = "light",
  as: Heading = "h2",
}: SectionTitleProps) {
  const dark = tone === "dark";

  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow && (
        <p
          className={cn(
            "mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
            dark
              ? "border-white/10 bg-white/5 text-aqua-300"
              : "border-brand-100 bg-brand-50 text-brand-700",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", dark ? "bg-aqua-400" : "bg-brand-500")}
            aria-hidden="true"
          />
          {eyebrow}
        </p>
      )}
      <Heading
        className={cn(
          "font-display text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]",
          dark ? "text-white" : "text-ink-900",
        )}
      >
        {title}
      </Heading>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-base leading-7 sm:text-lg sm:leading-8",
            dark ? "text-white/70" : "text-ink-900/65",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
