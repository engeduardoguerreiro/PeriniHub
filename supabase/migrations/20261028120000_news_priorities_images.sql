-- PeriniHub Tech: prioridades editoriais por categoria, novas fontes e capas
-- a partir das imagens de divulgação das fontes (hospedadas no Storage).
-- Aditiva: nenhuma tabela ou coluna é removida.

-- ---------------------------------------------------------------------------
-- Prioridade por categoria (1 = mais importante). Usada na curadoria e na
-- ordem de redação; categorias sem prioridade definida ficam em 4.
-- ---------------------------------------------------------------------------
alter table public.news_categories
  add column priority smallint not null default 4 check (priority between 1 and 5);

-- "Segurança" passa a ser "Cibersegurança" (o site redireciona a URL antiga).
update public.news_categories
set name = 'Cibersegurança',
    slug = 'ciberseguranca',
    description = 'Vulnerabilidades, ataques, correções e boas práticas de segurança da informação.'
where slug = 'seguranca';

insert into public.news_categories (name, slug, description, priority) values
  ('Linux', 'linux', 'Kernel, distribuições, desktop e servidores Linux e software livre.', 1),
  ('Segurança Eletrônica', 'seguranca-eletronica', 'CFTV, videomonitoramento, controle de acesso, alarmes e automação predial.', 2),
  ('DevOps', 'devops', 'CI/CD, containers, Kubernetes, infraestrutura como código e observabilidade.', 3)
on conflict (slug) do nothing;

update public.news_categories set priority = 1 where slug in ('linux', 'inteligencia-artificial');
update public.news_categories set priority = 2 where slug = 'seguranca-eletronica';
update public.news_categories set priority = 3 where slug in ('devops', 'ciberseguranca');

-- Ordem de exibição acompanha a prioridade.
update public.news_categories c
set sort_order = o.position
from (
  select id, row_number() over (order by priority, case slug
    when 'linux' then 1 when 'inteligencia-artificial' then 2
    when 'seguranca-eletronica' then 3 when 'ciberseguranca' then 4 when 'devops' then 5
    else 6 end, name) as position
  from public.news_categories
) o
where c.id = o.id;

-- ---------------------------------------------------------------------------
-- Configurações: imagens das fontes e mais candidatos por coleta
-- ---------------------------------------------------------------------------
alter table public.news_editorial_settings
  add column source_images_enabled boolean not null default true;

-- Com ~50 fontes, 15 candidatos por coleta deixaria fila acumulada. A
-- classificação em lote custa centavos; o limite de redação continua o mesmo.
update public.news_editorial_settings set max_candidates_per_run = 45 where id = 1 and max_candidates_per_run = 15;

-- ---------------------------------------------------------------------------
-- Fontes reclassificadas e novas (feeds conferidos em 2026-10-28)
-- ---------------------------------------------------------------------------
update public.news_sources set category_id = (select id from public.news_categories where slug = 'devops')
where feed_url in ('https://kubernetes.io/feed.xml');

insert into public.news_sources (name, website_url, feed_url, trust_level, category_id)
select s.name, s.website_url, s.feed_url, s.trust_level::public.news_trust_level, c.id
from (values
  -- Linux (prioridade 1)
  ('Viva o Linux', 'https://www.vivaolinux.com.br/', 'https://www.vivaolinux.com.br/index.rdf', 'medium', 'linux'),
  ('9to5Linux', 'https://9to5linux.com/', 'https://9to5linux.com/feed', 'high', 'linux'),
  ('Phoronix', 'https://www.phoronix.com/', 'https://www.phoronix.com/rss.php', 'high', 'linux'),
  ('OMG! Ubuntu', 'https://www.omgubuntu.co.uk/', 'https://www.omgubuntu.co.uk/feed', 'medium', 'linux'),
  ('Ubuntu Blog', 'https://ubuntu.com/blog', 'https://ubuntu.com/blog/feed', 'official', 'linux'),
  ('Fedora Magazine', 'https://fedoramagazine.org/', 'https://fedoramagazine.org/feed/', 'official', 'linux'),
  ('LWN.net', 'https://lwn.net/', 'https://lwn.net/headlines/rss', 'high', 'linux'),
  ('Kernel.org', 'https://www.kernel.org/', 'https://www.kernel.org/feeds/kdist.xml', 'official', 'linux'),
  ('Red Hat Blog', 'https://www.redhat.com/en/blog', 'https://www.redhat.com/en/rss/blog', 'official', 'linux'),
  ('Arch Linux News', 'https://archlinux.org/news/', 'https://archlinux.org/feeds/news/', 'official', 'linux'),
  ('Linux Foundation', 'https://www.linuxfoundation.org/blog', 'https://www.linuxfoundation.org/blog/rss.xml', 'official', 'linux'),
  ('Debian News', 'https://www.debian.org/News/', 'https://www.debian.org/News/news', 'official', 'linux'),
  -- Inteligência Artificial (prioridade 1)
  ('Google AI Blog', 'https://blog.google/technology/ai/', 'https://blog.google/innovation-and-ai/technology/ai/rss/', 'official', 'inteligencia-artificial'),
  ('Google DeepMind', 'https://deepmind.google/discover/blog/', 'https://deepmind.google/blog/rss.xml', 'official', 'inteligencia-artificial'),
  ('NVIDIA Blog', 'https://blogs.nvidia.com/', 'https://blogs.nvidia.com/feed/', 'official', 'inteligencia-artificial'),
  ('The Verge — IA', 'https://www.theverge.com/ai-artificial-intelligence', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'medium', 'inteligencia-artificial'),
  ('AWS Machine Learning Blog', 'https://aws.amazon.com/blogs/machine-learning/', 'https://aws.amazon.com/blogs/machine-learning/feed/', 'official', 'inteligencia-artificial'),
  -- Segurança Eletrônica (prioridade 2)
  ('Revista Segurança Eletrônica', 'https://revistasegurancaeletronica.com.br/', 'https://revistasegurancaeletronica.com.br/feed/', 'high', 'seguranca-eletronica'),
  ('Axis Communications Newsroom', 'https://newsroom.axis.com/', 'https://newsroom.axis.com/rss.xml', 'official', 'seguranca-eletronica'),
  ('Gestão de Segurança Privada', 'https://gestaodesegurancaprivada.com.br/', 'https://gestaodesegurancaprivada.com.br/feed/', 'medium', 'seguranca-eletronica'),
  -- DevOps (prioridade 3)
  ('Docker Blog', 'https://www.docker.com/blog/', 'https://www.docker.com/feed/', 'official', 'devops'),
  ('CNCF Blog', 'https://www.cncf.io/blog/', 'https://www.cncf.io/feed/', 'official', 'devops'),
  ('GitLab Blog', 'https://about.gitlab.com/blog/', 'https://about.gitlab.com/atom.xml', 'official', 'devops'),
  ('HashiCorp Blog', 'https://www.hashicorp.com/blog', 'https://www.hashicorp.com/blog/feed.xml', 'official', 'devops'),
  ('Grafana Labs Blog', 'https://grafana.com/blog/', 'https://grafana.com/blog/index.xml', 'official', 'devops'),
  -- Cibersegurança (prioridade 3)
  ('BleepingComputer', 'https://www.bleepingcomputer.com/', 'https://www.bleepingcomputer.com/feed/', 'high', 'ciberseguranca'),
  ('The Hacker News', 'https://thehackernews.com/', 'https://feeds.feedburner.com/TheHackersNews', 'high', 'ciberseguranca'),
  ('Krebs on Security', 'https://krebsonsecurity.com/', 'https://krebsonsecurity.com/feed/', 'high', 'ciberseguranca'),
  ('Google Security Blog', 'https://security.googleblog.com/', 'https://security.googleblog.com/feeds/posts/default', 'official', 'ciberseguranca'),
  ('Microsoft Security Blog', 'https://www.microsoft.com/en-us/security/blog/', 'https://www.microsoft.com/en-us/security/blog/feed/', 'official', 'ciberseguranca'),
  ('CERT.br', 'https://www.cert.br/', 'https://www.cert.br/rss/certbr-rss.xml', 'official', 'ciberseguranca')
) as s (name, website_url, feed_url, trust_level, category_slug)
join public.news_categories c on c.slug = s.category_slug
on conflict (feed_url) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: capas hospedadas no próprio projeto (leitura pública, escrita só
-- pelo worker com a secret key). Sem SVG: só formatos raster.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-covers', 'news-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;
