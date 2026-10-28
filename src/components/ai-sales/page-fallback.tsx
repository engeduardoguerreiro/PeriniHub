/** Esqueleto do conteúdo das páginas do AI Sales enquanto os dados carregam. */
export function PageFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
