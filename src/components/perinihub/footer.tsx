import Link from "next/link";

import { Brand } from "@/components/perinihub/brand";
import { WhatsAppFloatingButton } from "@/components/perinihub/whatsapp-floating-button";
import { CONTACT_EMAIL, ecosystemCards, navItems, WHATSAPP_URL } from "@/lib/site";

const linkClass =
  "rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400";

const newTab = <span className="sr-only"> (abre em nova aba)</span>;

export function Footer() {
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
            <nav aria-label="Rodapé" className="grid gap-3">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </FooterColumn>
          <FooterColumn title="Produtos">
            {/* Sem noreferrer de propósito: os destinos são produtos próprios e o
                referrer ajuda a medir quanto tráfego vem do site institucional. */}
            {ecosystemCards.map((product) => (
              <a key={product.name} href={product.href} target="_blank" rel="noopener" className={linkClass}>
                {product.name}
                {newTab}
              </a>
            ))}
          </FooterColumn>
          <FooterColumn title="Contato">
            <address className="grid gap-3 not-italic">
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                {CONTACT_EMAIL}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                WhatsApp
                {newTab}
              </a>
            </address>
          </FooterColumn>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          {/* Páginas estáticas: o ano é o do build, atualizado a cada deploy. */}
          <p>© {new Date().getFullYear()} PeriniHub. Todos os direitos reservados.</p>
          <p>perinihub.com.br</p>
        </div>
      </div>
      {/* Dentro do <footer> para ficar em um landmark. */}
      <WhatsAppFloatingButton />
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 text-sm">{children}</div>
    </div>
  );
}
