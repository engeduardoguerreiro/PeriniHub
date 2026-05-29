import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 74"
      className={`w-10 shrink-0 drop-shadow-sm ${className}`}
      fill="none"
      role="img"
      aria-label="Monograma PH da PeriniHub"
    >
      <path
        d="M32 3 58 14v27c0 15.5-10.7 24.4-26 29C16.7 65.4 6 56.5 6 41V14L32 3Z"
        fill="white"
        stroke="#242B32"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path d="M19 19h26l-7-5-6 3-6-3-7 5Z" fill="#E4161C" />
      <path
        d="M18 30h18c7 0 10 3.4 10 8.4 0 5.2-3.2 8.7-10.1 8.7H26v13h-8V30Zm8 7v3.6h10.1c1.6 0 2.4-.7 2.4-1.8S37.7 37 36.1 37H26Z"
        fill="#242B32"
      />
      <path d="M43 30h8v30h-8V48H31v-7h12V30Z" fill="#242B32" />
      <path d="M29 51h7v15l-7-2.3V51Z" fill="#E4161C" />
    </svg>
  );
}

export function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <a
      href="#inicio"
      className={`flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-4 ${className}`}
      aria-label="PeriniHub - voltar ao início"
    >
      <BrandMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-black tracking-[0.18em] text-zinc-900">
            PERINI
          </span>
          <span className="mt-1 block text-xs font-semibold tracking-[0.48em] text-zinc-600">
            HUB
          </span>
        </span>
      )}
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
