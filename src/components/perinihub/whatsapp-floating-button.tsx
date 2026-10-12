import { MessageCircle } from "lucide-react";

import { WHATSAPP_URL } from "@/lib/site";

export function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a PeriniHub pelo WhatsApp (abre em nova aba)"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-ink-950 shadow-[0_12px_30px_-8px_rgb(37_211_102/0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 motion-reduce:transition-none sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
