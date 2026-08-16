type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  tone = "light",
}: SectionTitleProps) {
  return (
    <div
      className={`mx-auto max-w-3xl ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      {eyebrow && (
        <p
          className={`mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-red-600 ${
            align === "center" ? "justify-center" : ""
          }`}
        >
          <span className="h-px w-6 bg-red-600/50" aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-display text-balance text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl lg:text-5xl ${
          tone === "dark" ? "text-white" : "text-zinc-950"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-5 text-base leading-8 sm:text-lg ${
            tone === "dark" ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
