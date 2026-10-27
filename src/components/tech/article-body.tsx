import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SITE_URL } from "@/lib/site";

// O conteúdo vem de IA a partir de fontes externas: trate como não confiável.
// - skipHtml: HTML embutido no Markdown é descartado (nada de <script>, <iframe>...).
// - Só elementos de texto: imagens e títulos de nível 1 ficam de fora (o h1 é o título).
// - URLs passam pelo urlTransform padrão (bloqueia javascript:, data: etc.) e
//   depois por safeHref, que só aceita http(s) e links internos.
const ALLOWED_ELEMENTS = [
  "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "del", "a", "blockquote",
  "code", "pre", "hr", "br", "table", "thead", "tbody", "tr", "th", "td",
];

export function safeHref(href: string | undefined): { href: string; external: boolean } | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return { href, external: false };
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.origin === SITE_URL) return { href: url.pathname + url.search + url.hash, external: false };
    return { href: url.toString(), external: true };
  } catch {
    return null;
  }
}

const components: Components = {
  h2: ({ children }) => (
    <h2 className="font-display mt-10 mb-4 text-2xl font-semibold tracking-tight text-ink-900 sm:text-[1.65rem]">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="font-display mt-8 mb-3 text-xl font-semibold tracking-tight text-ink-900">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-6 mb-2 text-lg font-semibold text-ink-900">{children}</h4>,
  p: ({ children }) => <p className="my-5">{children}</p>,
  ul: ({ children }) => <ul className="my-5 list-disc space-y-2 pl-6 marker:text-brand-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 list-decimal space-y-2 pl-6 marker:text-brand-600">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-4 border-brand-300 bg-brand-50/60 py-1 pl-5 pr-3 text-ink-900/80">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-ink-900/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-ink-900">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-xl bg-ink-950 p-4 font-mono text-sm leading-6 text-white/90 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-ink-900/10">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-ink-900/10 bg-ink-900/[0.03] px-4 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-ink-900/5 px-4 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-10 border-ink-900/10" />,
  a: ({ href, children }) => {
    const safe = safeHref(href);
    if (!safe) return <>{children}</>;
    const className = "font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-600";
    if (!safe.external) {
      return (
        <Link href={safe.href} className={className}>
          {children}
        </Link>
      );
    }
    return (
      <a href={safe.href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {children}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    );
  },
};

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-[17px] leading-8 text-ink-900/85 [&>*:first-child]:mt-0">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
