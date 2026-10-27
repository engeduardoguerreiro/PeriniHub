-- PeriniHub Tech: dados iniciais. Idempotente (on conflict do nothing):
-- reaplicar não sobrescreve ajustes feitos depois pelo painel.

insert into public.news_editorial_settings (id) values (1)
on conflict (id) do nothing;

insert into public.news_categories (name, slug, description, sort_order) values
  ('Inteligência Artificial', 'inteligencia-artificial', 'Modelos, ferramentas e pesquisa em IA aplicada.', 1),
  ('Desenvolvimento Web', 'desenvolvimento-web', 'Frameworks, navegadores e padrões da web.', 2),
  ('Linguagens e Ferramentas', 'linguagens-e-ferramentas', 'Lançamentos de linguagens, runtimes e ferramentas de desenvolvimento.', 3),
  ('Cloud e Infraestrutura', 'cloud-e-infraestrutura', 'Provedores de nuvem, containers e plataformas de deploy.', 4),
  ('Dados', 'dados', 'Bancos de dados e plataformas de dados.', 5),
  ('Segurança', 'seguranca', 'Vulnerabilidades, alertas e boas práticas de segurança.', 6)
on conflict (slug) do nothing;

-- Preços por milhão de tokens (US$) da Anthropic em 2026-10. Curadoria e SEO em
-- modelo econômico; redação e verificação em modelo de qualidade.
insert into public.news_agent_models
  (agent_name, provider, model, max_output_tokens, input_price_per_mtok, output_price_per_mtok)
values
  ('researcher', 'anthropic', 'claude-haiku-5-5', 2048, 0.10, 0.50),
  ('curator', 'anthropic', 'claude-haiku-5-5', 2048, 0.10, 0.50),
  ('writer', 'anthropic', 'claude-sonnet-5-5', 8000, 2.00, 10.00),
  ('fact_checker', 'anthropic', 'claude-sonnet-5-5', 6000, 2.00, 10.00),
  ('seo_editor', 'anthropic', 'claude-haiku-5-5', 2048, 0.10, 0.50)
on conflict (agent_name) do nothing;

-- Feeds oficiais (RSS/Atom) conferidos em 2026-10-27.
insert into public.news_sources (name, website_url, feed_url, trust_level, category_id)
select s.name, s.website_url, s.feed_url, s.trust_level::public.news_trust_level, c.id
from (values
  ('OpenAI News', 'https://openai.com/news/', 'https://openai.com/news/rss.xml', 'official', 'inteligencia-artificial'),
  ('Hugging Face Blog', 'https://huggingface.co/blog', 'https://huggingface.co/blog/feed.xml', 'official', 'inteligencia-artificial'),
  ('Next.js Blog', 'https://nextjs.org/blog', 'https://nextjs.org/feed.xml', 'official', 'desenvolvimento-web'),
  ('React Blog', 'https://react.dev/blog', 'https://react.dev/rss.xml', 'official', 'desenvolvimento-web'),
  ('Chrome for Developers', 'https://developer.chrome.com/blog', 'https://developer.chrome.com/static/blog/feed.xml', 'official', 'desenvolvimento-web'),
  ('Mozilla Hacks', 'https://hacks.mozilla.org/', 'https://hacks.mozilla.org/feed/', 'official', 'desenvolvimento-web'),
  ('Tailwind CSS Blog', 'https://tailwindcss.com/blog', 'https://tailwindcss.com/feeds/feed.xml', 'official', 'desenvolvimento-web'),
  ('GitHub Changelog', 'https://github.blog/changelog/', 'https://github.blog/changelog/feed/', 'official', 'linguagens-e-ferramentas'),
  ('TypeScript Blog', 'https://devblogs.microsoft.com/typescript/', 'https://devblogs.microsoft.com/typescript/feed/', 'official', 'linguagens-e-ferramentas'),
  ('Node.js Blog', 'https://nodejs.org/en/blog', 'https://nodejs.org/en/feed/blog.xml', 'official', 'linguagens-e-ferramentas'),
  ('Python Insider', 'https://blog.python.org/', 'https://blog.python.org/feeds/posts/default', 'official', 'linguagens-e-ferramentas'),
  ('Rust Blog', 'https://blog.rust-lang.org/', 'https://blog.rust-lang.org/feed.xml', 'official', 'linguagens-e-ferramentas'),
  ('Deno Blog', 'https://deno.com/blog', 'https://deno.com/feed', 'official', 'linguagens-e-ferramentas'),
  ('Google Developers Blog', 'https://developers.googleblog.com/', 'https://developers.googleblog.com/feeds/posts/default/', 'official', 'linguagens-e-ferramentas'),
  ('Vercel Blog', 'https://vercel.com/blog', 'https://vercel.com/atom', 'official', 'cloud-e-infraestrutura'),
  ('AWS What''s New', 'https://aws.amazon.com/new/', 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', 'official', 'cloud-e-infraestrutura'),
  ('Kubernetes Blog', 'https://kubernetes.io/blog/', 'https://kubernetes.io/feed.xml', 'official', 'cloud-e-infraestrutura'),
  ('Cloudflare Blog', 'https://blog.cloudflare.com/', 'https://blog.cloudflare.com/rss/', 'official', 'cloud-e-infraestrutura'),
  ('Supabase Blog', 'https://supabase.com/blog', 'https://supabase.com/rss.xml', 'official', 'dados'),
  ('PostgreSQL News', 'https://www.postgresql.org/about/newsarchive/', 'https://www.postgresql.org/news.rss', 'official', 'dados'),
  ('CISA Cybersecurity Advisories', 'https://www.cisa.gov/news-events/cybersecurity-advisories', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'official', 'seguranca')
) as s (name, website_url, feed_url, trust_level, category_slug)
join public.news_categories c on c.slug = s.category_slug
on conflict (feed_url) do nothing;

-- Administrador inicial (o usuário é criado no painel do Supabase Auth).
insert into public.admin_profiles (user_id, role, display_name)
select id, 'admin', 'PeriniHub'
from auth.users
where email = 'contato@perinihub.com.br'
on conflict (user_id) do nothing;
