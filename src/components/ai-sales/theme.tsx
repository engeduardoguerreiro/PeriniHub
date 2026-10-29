"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { THEME_ROOT_ID, THEME_STORAGE_KEY } from "./theme-script";

// Tema do AI Sales: claro, escuro ou do sistema, guardado no navegador. A
// classe .dark vai só no contêiner #ai-sales-root, então o site público nunca
// é afetado. O script inline (theme-script.ts) roda antes da pintura.

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.getElementById(THEME_ROOT_ID)?.classList.toggle("dark", dark);
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "system", label: "Tema do sistema", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Sincroniza com o que o script inline já aplicou (localStorage só existe no cliente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readTheme() === "system" && applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function choose(value: Theme) {
    try {
      if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Armazenamento bloqueado: o tema vale só nesta visita.
    }
    applyTheme(value);
    setTheme(value);
  }

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-full border border-white/10 bg-white/5 p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400",
            theme === value && "bg-white/15 text-white",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
