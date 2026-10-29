// Constantes do formulário público usadas também no navegador (sem dependências do servidor).

/** Campo invisível: pessoas não preenchem; robôs costumam preencher. */
export const HONEYPOT_FIELD = "site_empresa";

export const FORM_FIELD_LABELS = {
  phone: "Telefone / WhatsApp",
  email: "E-mail",
  company: "Empresa",
  job_title: "Cargo",
  message: "Mensagem",
} as const;
