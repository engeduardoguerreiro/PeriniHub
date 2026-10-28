// Fatia documentos da base de conhecimento em trechos de até ~900
// caracteres, respeitando parágrafos e frases (melhor para a busca textual).

export const MAX_DOCUMENT_CHARS = 200_000;
const TARGET = 900;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (!clean) return [];
  const pieces = clean.split(/\n{2,}/).flatMap((paragraph) =>
    paragraph.length <= TARGET ? [paragraph.trim()] : (paragraph.match(/[^.!?\n]+[.!?]?\s*/g) ?? [paragraph]).map((sentence) => sentence.trim()),
  );
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces.filter(Boolean)) {
    const part = piece.length > TARGET * 2 ? piece.slice(0, TARGET * 2) : piece;
    if (current && current.length + part.length + 1 > TARGET) {
      chunks.push(current);
      current = part;
    } else {
      current = current ? `${current}\n${part}` : part;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk) => chunk.slice(0, 4000));
}
