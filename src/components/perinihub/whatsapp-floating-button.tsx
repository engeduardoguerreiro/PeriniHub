"use client";

import { MessageCircle } from "lucide-react";

import { WHATSAPP_URL } from "@/lib/site";

export function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a PeriniHub pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-md bg-red-600 text-white shadow-2xl shadow-red-900/25 transition hover:-translate-y-0.5 hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-4 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
