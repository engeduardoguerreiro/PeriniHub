import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 74"
      className={`block h-12 w-10 shrink-0 ${className}`}
      fill="none"
      role="img"
      aria-label="Escudo PH da PeriniHub"
    >
      <path
        d="M32 4 57 15v25.8c0 15.2-10.2 24.3-25 28.9C17.2 65.1 7 56 7 40.8V15L32 4Z"
        fill="white"
        stroke="#242B32"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path d="M19 20 32 13l13 7h-9.3L32 18l-3.7 2H19Z" fill="#E4161C" />
      <path
        d="M18 31h19c6.2 0 9.7 3.2 9.7 8.2 0 5.1-3.6 8.5-9.8 8.5H27.2v14.1h-8.1V41h17.1c1.8 0 2.7-.7 2.7-2 0-1.2-.9-1.9-2.7-1.9H18V31Z"
        fill="#242B32"
      />
      <path d="M44.2 31h8.1v30.8h-8.1V49H31.8v-7.4h12.4V31Z" fill="#242B32" />
      <path d="M29.1 51.2h7.8v15.2L32 68l-2.9-.9V51.2Z" fill="#E4161C" />
    </svg>
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
