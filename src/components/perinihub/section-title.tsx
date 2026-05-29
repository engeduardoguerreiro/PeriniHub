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
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-red-600">
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-balance text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl ${
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
