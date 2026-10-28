// Smoke test do build de produção: sobe `next start` e confere rotas,
// metadados e o formulário no HTML servido. Uso: npm run build && npm run smoke
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = process.env.SMOKE_PORT ?? "3100";
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = "https://perinihub.com.br";

// Grupo de processos próprio (detached) para encerrar o next-server junto;
// matar só o processo pai deixaria o servidor órfão segurando a porta.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", PORT], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  detached: true,
});

const failures = [];
function check(condition, label) {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) failures.push(label);
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`next start não respondeu em ${timeoutMs} ms`);
}

async function get(path) {
  const response = await fetch(BASE + path, { redirect: "manual" });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

try {
  await waitForServer();

  const home = await get("/");
  check(home.status === 200, "GET / -> 200");
  check(home.body.includes('<html lang="pt-BR"'), "/ declara lang pt-BR");
  check(/<title>PeriniHub \| [^<]+<\/title>/.test(home.body), "/ tem <title> padrão");
  check(home.body.includes(`<link rel="canonical" href="${SITE}"`), "/ tem canonical");
  check(home.body.includes('property="og:image"'), "/ tem og:image");
  check(home.body.includes('id="contato"'), "/ renderiza a seção de contato");
  check(home.body.includes("Solicitar orçamento"), "/ renderiza o formulário");

  const clientes = await get("/clientes");
  check(clientes.status === 200, "GET /clientes -> 200");
  check(
    clientes.body.includes("<title>Clientes e projetos entregues | PeriniHub</title>"),
    "/clientes usa o template de título",
  );
  check(clientes.body.includes(`property="og:url" content="${SITE}/clientes"`), "/clientes tem og:url próprio");
  check(clientes.body.includes(`<link rel="canonical" href="${SITE}/clientes"`), "/clientes tem canonical");

  const sitemap = await get("/sitemap.xml");
  check(sitemap.status === 200 && sitemap.body.includes(`<loc>${SITE}/clientes</loc>`), "sitemap.xml lista /clientes");

  const robots = await get("/robots.txt");
  check(robots.status === 200 && robots.body.includes(`Sitemap: ${SITE}/sitemap.xml`) && robots.body.includes(`Sitemap: ${SITE}/tech/news-sitemap.xml`), "robots.txt aponta os sitemaps");

  const og = await get("/opengraph-image");
  check(og.status === 200 && og.headers.get("content-type")?.startsWith("image/png"), "opengraph-image gera PNG");

  const missing = await get("/rota-que-nao-existe");
  check(missing.status === 404, "rota inexistente -> 404");
  check(missing.body.includes("Página não encontrada"), "404 em português");

  // PeriniHub Tech: funciona com ou sem Supabase configurado (no CI, sem notícias).
  const tech = await get("/tech");
  check(tech.status === 200 && tech.body.includes("Notícias de tecnologia"), "GET /tech -> 200");
  check(tech.body.includes(`<link rel="canonical" href="${SITE}/tech"`), "/tech tem canonical");
  check(tech.body.includes('type="application/rss+xml"'), "/tech anuncia o RSS");
  check(home.body.includes('href="/tech"'), "menu do site leva ao portal");

  const rss = await get("/tech/rss.xml");
  check(rss.status === 200 && rss.headers.get("content-type")?.includes("application/rss+xml"), "RSS do portal");
  const newsSitemap = await get("/tech/news-sitemap.xml");
  check(newsSitemap.status === 200 && newsSitemap.body.includes("sitemap-news"), "sitemap de notícias");
  check(sitemap.body.includes(`<loc>${SITE}/tech</loc>`), "sitemap.xml lista /tech");
  check(robots.body.includes("Disallow: /admin"), "robots.txt bloqueia /admin");

  const slugCase = await get("/tech/Noticia-Teste");
  check(slugCase.status === 308 && slugCase.headers.get("location")?.endsWith("/tech/noticia-teste"), "slug fora do padrão -> 308 canônico");

  const oldCategory = await get("/tech/categoria/ciberseguranca");
  check(oldCategory.status === 308 && new URL(oldCategory.headers.get("location") ?? "", BASE).pathname === "/tech", "página de categoria antiga redireciona 308 para /tech");

  const login = await get("/admin/login");
  check(login.status === 200 && login.headers.get("x-robots-tag") === "noindex, nofollow", "/admin/login com X-Robots-Tag noindex");

  const revalidate = await fetch(BASE + "/api/news/revalidate", { method: "POST", body: "{}" });
  check([401, 503].includes(revalidate.status), "revalidação sem assinatura é recusada");

  const csp = home.headers.get("content-security-policy") ?? "";
  check(csp.includes("frame-ancestors 'none'"), "CSP com frame-ancestors 'none'");
  check(home.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");

  // fetch() descarta o header Host; node:http permite simular o domínio www.
  const www = await new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: PORT, path: "/clientes", headers: { host: "www.perinihub.com.br" } }, (res) => {
        res.resume();
        resolve(res);
      })
      .on("error", reject);
  });
  check(
    www.statusCode === 308 && www.headers.location === `${SITE}/clientes`,
    "host www redireciona 308 para o domínio principal",
  );
} catch (error) {
  failures.push(String(error));
  console.error(error);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // já encerrado
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nSmoke test OK.");
