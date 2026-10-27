import { Share2 } from "lucide-react";

import { CopyLinkButton } from "./copy-link-button";

/** URLs de compartilhamento: links simples, sem scripts de terceiros. */
export function shareUrls(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
}

const buttonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-900/10 bg-white px-3.5 text-sm font-medium text-ink-900/80 transition-colors hover:border-brand-200 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function ShareLinks({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-900/60">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Compartilhar
      </span>
      {shareUrls(url, title).map((item) => (
        <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          {item.label}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ))}
      <CopyLinkButton url={url} className={buttonClass} />
    </div>
  );
}
