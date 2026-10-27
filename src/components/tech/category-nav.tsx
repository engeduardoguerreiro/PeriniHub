import { Search } from "lucide-react";
import Link from "next/link";

import type { Category } from "@/lib/news/queries";
import { cn } from "@/lib/utils";

const chipClass =
  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function CategoryNav({ categories, active }: { categories: Category[]; active?: string }) {
  return (
    <nav aria-label="Categorias" className="flex items-center gap-2 overflow-x-auto pb-1">
      <Link
        href="/tech"
        aria-current={!active ? "page" : undefined}
        className={cn(
          chipClass,
          !active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-900/10 bg-white text-ink-900/75 hover:border-brand-200 hover:text-ink-900",
        )}
      >
        Todas
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/tech/categoria/${category.slug}`}
          aria-current={active === category.slug ? "page" : undefined}
          className={cn(
            chipClass,
            active === category.slug
              ? "border-ink-900 bg-ink-900 text-white"
              : "border-ink-900/10 bg-white text-ink-900/75 hover:border-brand-200 hover:text-ink-900",
          )}
        >
          {category.name}
        </Link>
      ))}
      <Link
        href="/tech/busca"
        className={cn(chipClass, "ml-auto inline-flex items-center gap-1.5 border-ink-900/10 bg-white text-ink-900/75 hover:text-ink-900")}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        Buscar
      </Link>
    </nav>
  );
}
