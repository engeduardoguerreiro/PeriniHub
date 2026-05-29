import {
  Blocks,
  Bot,
  ChartNoAxesCombined,
  Code2,
  Gauge,
  Globe2,
  Layers3,
  Lightbulb,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

export const WHATSAPP_NUMBER = "5511930230911";
export const WHATSAPP_MESSAGE =
  "Olá, vim pelo site da PeriniHub e gostaria de falar sobre um projeto digital.";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE,
)}`;

export const navItems = [
  { label: "Início", href: "#inicio" },
  { label: "Ecossistema", href: "#ecossistema" },
  { label: "Soluções", href: "#solucoes" },
  { label: "Produtos", href: "#produtos" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

export const positioningCards = [
  {
    title: "Produtos próprios",
    description:
      "Desenvolvimento de plataformas e SaaS voltados a nichos com potencial de recorrência.",
    icon: Rocket,
  },
  {
    title: "Soluções sob demanda",
    description:
      "Criação de sistemas, sites, aplicações web e automações para empresas que precisam digitalizar processos.",
    icon: Code2,
  },
  {
    title: "Ecossistema escalável",
    description:
      "Estrutura pensada para abrigar diferentes produtos digitais sob uma marca forte e consistente.",
    icon: Network,
  },
];

export const ecosystemCards = [
  {
    name: "PeriniFood",
    description:
      "Solução digital para restaurantes, pizzarias, delivery e negócios de alimentação, com foco em pedidos, cardápio, gestão e integração.",
    status: "Em desenvolvimento",
    action: "Em breve",
    icon: Globe2,
  },
  {
    name: "PrivacyLog",
    description:
      "Plataforma digital para descoberta, reputação e gestão de presença online em mercados premium e segmentados.",
    status: "Em validação",
    action: "Em breve",
    icon: ShieldCheck,
  },
  {
    name: "Soluções Web",
    description:
      "Criação de sites institucionais, landing pages, sistemas internos, dashboards e plataformas digitais sob medida.",
    status: "Ativo",
    action: "Saiba mais",
    icon: Layers3,
  },
  {
    name: "Automações Comerciais",
    description:
      "Fluxos digitais, formulários inteligentes, integrações e ferramentas para reduzir processos manuais.",
    status: "Planejado",
    action: "Em breve",
    icon: Workflow,
  },
];

export const solutions = [
  {
    title: "Desenvolvimento de SaaS",
    description:
      "Planejamento e construção de plataformas digitais com foco em recorrência, escalabilidade e usabilidade.",
    icon: Blocks,
  },
  {
    title: "Sistemas Web Sob Medida",
    description:
      "Aplicações personalizadas para gestão, operação, atendimento, cadastro, controle e análise de dados.",
    icon: Code2,
  },
  {
    title: "Sites e Landing Pages",
    description:
      "Páginas modernas, rápidas e comerciais para empresas que precisam melhorar sua presença digital.",
    icon: Globe2,
  },
  {
    title: "Dashboards e Painéis",
    description:
      "Interfaces para visualizar indicadores, acompanhar operação e tomar decisões com mais clareza.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Integrações e Automações",
    description:
      "Conexão entre ferramentas, formulários, notificações, WhatsApp, bancos de dados e APIs.",
    icon: Bot,
  },
  {
    title: "Consultoria de Produto Digital",
    description:
      "Apoio estratégico para transformar ideias em MVPs, organizar escopo e priorizar funcionalidades.",
    icon: Lightbulb,
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

export const reasons = [
  "Visão prática de negócio",
  "Foco em produtos que geram receita",
  "Desenvolvimento moderno e escalável",
  "Design limpo e profissional",
  "Estrutura preparada para novos SaaS",
  "Mentalidade de MVP e validação rápida",
];

export const projectTypes = [
  "SaaS",
  "Sistema web",
  "Site institucional",
  "Landing page",
  "Dashboard",
  "Automação",
  "Consultoria",
  "Outro",
];

export const heroSignals = [
  { label: "SaaS", icon: Sparkles },
  { label: "Automação", icon: Workflow },
  { label: "Sistemas Web", icon: Code2 },
  { label: "Plataformas Digitais", icon: Layers3 },
  { label: "Inteligência Operacional", icon: Gauge },
];
