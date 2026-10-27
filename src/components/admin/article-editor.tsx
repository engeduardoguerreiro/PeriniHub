"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { updateArticle, type ActionResult } from "@/app/admin/(painel)/noticias/actions";

import { buttonClass, ResultMessage } from "./action-button";
import { inputClass, labelClass } from "./ui";

type ArticleEditorProps = {
  article: { id: string; title: string; subtitle: string | null; excerpt: string; content: string; slug: string; categoryId: string | null; published: boolean };
  categories: { id: string; name: string }[];
};

export function ArticleEditor({ article, categories }: ArticleEditorProps) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateArticle, null);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="articleId" value={article.id} />
      <label className="grid gap-1.5">
        <span className={labelClass}>Título</span>
        <input name="title" defaultValue={article.title} required minLength={10} maxLength={160} className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Subtítulo</span>
        <input name="subtitle" defaultValue={article.subtitle ?? ""} maxLength={300} className={inputClass} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClass}>Resumo</span>
        <textarea name="excerpt" defaultValue={article.excerpt} required minLength={20} maxLength={400} rows={3} className={`${inputClass} h-auto py-2`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={labelClass}>Slug</span>
          <input
            name="slug"
            defaultValue={article.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            readOnly={article.published}
            title={article.published ? "Artigo publicado: o slug não muda para não quebrar links" : undefined}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Categoria</span>
          <select name="categoryId" defaultValue={article.categoryId ?? ""} className={inputClass}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className={labelClass}>Conteúdo (Markdown)</span>
        <textarea
          name="content"
          defaultValue={article.content}
          required
          minLength={200}
          maxLength={40000}
          rows={18}
          className={`${inputClass} h-auto py-2 font-mono text-[13px] leading-6`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass("dark")} disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar alterações
        </button>
        <ResultMessage result={result} />
      </div>
      <p className="text-xs text-ink-900/55">
        Alterar o texto de um artigo aprovado ou agendado o devolve para revisão. Edições em artigos publicados vão ao ar na hora e ficam na auditoria.
      </p>
    </form>
  );
}
