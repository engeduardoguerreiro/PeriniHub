import { Brand } from "@/components/perinihub/brand";
import { Separator } from "@/components/ui/separator";
import { WHATSAPP_URL, navItems } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white/70 px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-600">
              Ecossistema de tecnologia, SaaS e soluções digitais.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-zinc-950">
              Links
            </h3>
            <nav className="mt-5 grid grid-cols-2 gap-3 text-sm text-zinc-600">
              {navItems
                .filter((item) =>
                  ["Início", "Ecossistema", "Soluções", "Produtos", "Contato"].includes(
                    item.label,
                  ),
                )
                .map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-red-600"
                  >
                    {item.label}
                  </a>
                ))}
            </nav>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-zinc-950">
              Contato
            </h3>
            <div className="mt-5 grid gap-3 text-sm text-zinc-600">
              <a href="mailto:contato@perinihub.com.br" className="hover:text-red-600">
                contato@perinihub.com.br
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hover:text-red-600">
                WhatsApp
              </a>
              <a href="#inicio" className="hover:text-red-600">
                perinihub.com.br
              </a>
            </div>
          </div>
        </div>
        <Separator className="my-8" />
        <p className="text-sm text-zinc-500">
          © 2026 PeriniHub. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
