import {
  Bot,
  Building2,
  ChartNoAxesCombined,
  Code2,
  Globe2,
  Headset,
  LayoutDashboard,
  MessageCircle,
  Pizza,
  Scissors,
  Smartphone,
  Timer,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

// Domínio de produção. Usado em metadados, canonical, sitemap e robots.
export const SITE_URL = "https://perinihub.com.br";

export const CONTACT_EMAIL = "contato@perinihub.com.br";

export const WHATSAPP_NUMBER = "5511930230911";
export const WHATSAPP_DISPLAY = "+55 11 93023-0911";
export const WHATSAPP_MESSAGE =
  "Olá, vim pelo site da PeriniHub e gostaria de um orçamento.";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE,
)}`;

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Serializa JSON-LD escapando `<`, como recomenda o guia de JSON-LD do Next. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const navItems = [
  { label: "Início", href: "/" },
  { label: "Serviços", href: "/#servicos" },
  { label: "Como trabalhamos", href: "/#processo" },
  { label: "Produtos", href: "/#produtos" },
  { label: "Clientes", href: "/clientes" },
  { label: "Contato", href: "/#contato" },
];

export const ecosystemCards: {
  name: string;
  description: string;
  highlights: string[];
  /** Sem link = produto ainda em desenvolvimento. */
  href?: string;
  icon: typeof UtensilsCrossed;
}[] = [
  {
    name: "Perini Food",
    description:
      "Cardápio digital, pedidos e gestão para restaurantes, pizzarias e delivery.",
    highlights: ["Cardápio online", "Integração iFood", "Pedidos no WhatsApp"],
    href: "https://perinifood.com.br",
    icon: UtensilsCrossed,
  },
  {
    name: "Perini One",
    description:
      "ERP online para pequenas empresas: vendas, estoque, compras, caixa e financeiro.",
    highlights: ["Vendas e estoque", "Financeiro e caixa", "Relatórios"],
    href: "https://www.perinione.com.br",
    icon: LayoutDashboard,
  },
  {
    name: "Perini Barber",
    description:
      "Agendamento online, clientes e faturamento para barbearias e salões.",
    highlights: ["Agenda online", "Clientes", "Faturamento"],
    icon: Scissors,
  },
];

/** Produtos já em operação (com site no ar). */
export const liveProducts = ecosystemCards.filter((product) => product.href);

export const heroStats = [
  { value: "24h", label: "para receber o orçamento" },
  { value: String(liveProducts.length), label: "SaaS próprios em operação" },
  { value: "100%", label: "preço fechado antes de começar" },
];

export const clients = [
  {
    name: "Pizzaria Forno Nordestino",
    segment: "Alimentação e delivery",
    description:
      "Operação de pedidos, cardápio digital e atendimento digitalizados com o Perini Food, do balcão ao delivery.",
    link: { label: "Ver o site", href: "https://fornonordestino.com.br/" },
    icon: Pizza,
  },
  {
    name: "Perini Engenharia",
    segment: "Engenharia elétrica",
    description:
      "Site institucional e sistemas internos desenvolvidos pela PeriniHub para apoiar a operação comercial da empresa.",
    link: { label: "Ver o site", href: "https://periniengenharia.com.br" },
    icon: Building2,
  },
];

export const solutions = [
  {
    title: "Sites e landing pages",
    description:
      "Site institucional ou página de vendas rápida, responsiva e pronta para gerar contatos.",
    icon: Globe2,
  },
  {
    title: "Sistemas web sob medida",
    description:
      "Sistemas de gestão, pedidos, agendamento, cadastro e controle feitos para a sua operação.",
    icon: Code2,
  },
  {
    title: "Painéis e relatórios",
    description:
      "Dashboards que mostram vendas, produtividade e indicadores do negócio em tempo real.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Integrações e automações",
    description:
      "WhatsApp, formulários, notificações, pagamentos e APIs conectados ao seu dia a dia.",
    icon: Bot,
  },
  {
    title: "Aplicações mobile-first",
    description:
      "Sistemas que funcionam bem no celular, para equipes que trabalham fora do escritório.",
    icon: Smartphone,
  },
  {
    title: "Manutenção e evolução",
    description:
      "Suporte contínuo, correções e novas funcionalidades depois que o projeto entra no ar.",
    icon: Headset,
  },
];

export const differentials = [
  {
    title: "Orçamento em até 24h",
    description:
      "Você conta o que precisa e recebe escopo e valor rápido, sem enrolação.",
    icon: Timer,
  },
  {
    title: "Preço fechado, sem surpresa",
    description:
      "O valor combinado é o valor final. Mudanças de escopo são sempre acordadas antes.",
    icon: Wallet,
  },
  {
    title: "Você fala direto com quem desenvolve",
    description:
      "Sem call center e sem intermediário: atendimento direto com o time técnico.",
    icon: MessageCircle,
  },
  {
    title: "Suporte depois da entrega",
    description:
      "O projeto não termina no lançamento. Acompanhamos, corrigimos e evoluímos junto.",
    icon: Headset,
  },
];

export const faq = [
  {
    question: "Quanto tempo leva para ficar pronto?",
    answer:
      "Uma landing page fica pronta em poucos dias. Um site institucional leva de 1 a 3 semanas. Sistemas sob medida dependem do escopo, e por isso começamos sempre por uma primeira versão enxuta que já possa ser usada.",
  },
  {
    question: "Quanto custa um projeto?",
    answer:
      "O valor depende do que precisa ser construído. Passamos um orçamento fechado antes de começar, sem custo e sem compromisso, para você decidir com o preço na mão.",
  },
  {
    question: "Vocês dão suporte depois de entregar?",
    answer:
      "Sim. Continuamos acompanhando o projeto com correções, ajustes e novas funcionalidades conforme o negócio cresce.",
  },
  {
    question: "Preciso já saber exatamente o que quero?",
    answer:
      "Não. A maioria dos clientes chega com um problema, não com uma especificação. Ajudamos a transformar isso em um escopo claro antes de escrever qualquer linha de código.",
  },
];

export const processSteps = [
  {
    title: "Diagnóstico",
    description: "Entendemos a operação, o problema e o objetivo do projeto.",
  },
  {
    title: "Estratégia",
    description:
      "Definimos escopo, funcionalidades, prioridades e melhor caminho técnico.",
  },
  {
    title: "Desenvolvimento",
    description:
      "Criamos a interface, banco de dados, fluxos e integrações necessárias.",
  },
  {
    title: "Evolução",
    description:
      "Acompanhamos melhorias, ajustes e novas oportunidades de crescimento.",
  },
];

export const projectTypes = [
  "Site institucional",
  "Landing page",
  "Sistema web sob medida",
  "Painel / dashboard",
  "Integração ou automação",
  "Demonstração do Perini Food",
  "Demonstração do Perini One",
  "Manutenção de sistema existente",
  "Outro",
];
