const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(value: string, maxLength = 120) {
  return value.length > 0 && value.length <= maxLength && SLUG_PATTERN.test(value);
}

/**
 * Gera slug ASCII a partir de um título em português: remove acentos, troca
 * qualquer outro caractere por hífen e corta no limite sem quebrar palavra.
 */
export function slugify(text: string, maxLength = 80) {
  const base = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= maxLength) return base;
  const cut = base.slice(0, maxLength + 1);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > maxLength / 2 ? cut.slice(0, lastHyphen) : base.slice(0, maxLength)).replace(/-+$/, "");
}

/** Slug livre de colisão: acrescenta -2, -3... respeitando o tamanho máximo. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, maxLength = 80) {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, maxLength - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Não foi possível gerar slug único");
}
