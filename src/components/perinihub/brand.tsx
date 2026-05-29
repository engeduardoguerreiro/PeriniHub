import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block h-12 w-10 shrink-0 ${className}`}>
      <Image
        src="/perinihub-shield.png"
        alt="Escudo PH da PeriniHub"
        fill
        sizes="64px"
        className="object-contain"
      />
    </span>
  );
}

export function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <a
      href="#inicio"
      className={`relative block h-14 ${
        compact ? "w-32" : "w-40"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-4 ${className}`}
      aria-label="PeriniHub - voltar ao início"
    >
      <Image
        src="/perinihub-logo-cropped.png"
        alt="PeriniHub"
        fill
        priority
        sizes={compact ? "128px" : "160px"}
        className="object-contain object-left"
      />
    </a>
  );
}

export function LogoPanel() {
  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200/80 bg-white/80 shadow-[0_30px_90px_rgba(24,24,27,0.12)]">
      <div className="absolute inset-0 grid-surface opacity-45" />
      <Image
        src="/perinihub-logo.png"
        alt="Logo PeriniHub com escudo PH e palavra Perini Hub"
        fill
        priority
        sizes="(max-width: 768px) 92vw, 48vw"
        className="object-contain p-8 sm:p-10"
      />
    </div>
  );
}
