import Link from "next/link";

import { Brand } from "@/components/perinihub/brand";
import { ecosystemCards, navItems, WHATSAPP_URL } from "@/lib/site";

const linkClass =
  "rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

export function Footer() {
  const liveProducts = ecosystemCards.filter((product) => product.href);

  return (
    <footer className="bg-ink-950 px-4 pb-10 pt-16 text-white/65 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Brand tone="dark" />
            <p className="mt-5 max-w-sm text-sm leading-7">
              Criação de sites e desenvolvimento de sistemas sob medida para empresas. Atendimento
              em todo o Brasil.
            </p>
          </div>
          <FooterColumn title="Navegação">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ))}
          </FooterColumn>
          <FooterColumn title="Produtos">
            {liveProducts.map((product) => (
              <a key={product.name} href={product.href} target="_blank" rel="noopener" className={linkClass}>
                {product.name}
              </a>
            ))}
          </FooterColumn>
          <FooterColumn title="Contato">
            <a href="mailto:contato@perinihub.com.br" className={linkClass}>
              contato@perinihub.com.br
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              WhatsApp
            </a>
          </FooterColumn>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PeriniHub. Todos os direitos reservados.</p>
          <p>perinihub.com.br</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <nav aria-label={title} className="mt-4 grid gap-3 text-sm">
        {children}
      </nav>
    </div>
  );
}
