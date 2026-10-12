import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "./contact-form";

// window.open é a fronteira com o mundo externo (abre o WhatsApp).
const openSpy = vi.fn();

beforeEach(() => {
  openSpy.mockReset();
  vi.stubGlobal("open", openSpy);
});

function setup() {
  const user = userEvent.setup();
  render(<ContactForm />);
  return {
    user,
    name: screen.getByLabelText(/nome completo/i),
    company: screen.getByLabelText(/empresa/i),
    whatsapp: screen.getByLabelText(/^whatsapp/i),
    projectType: screen.getByLabelText(/tipo de projeto/i),
    message: screen.getByLabelText(/o que você precisa/i),
    submit: screen.getByRole("button", { name: /solicitar orçamento/i }),
  };
}

async function fillValid(f: ReturnType<typeof setup>, overrides: { company?: string } = {}) {
  await f.user.type(f.name, "Maria Silva");
  if (overrides.company !== "") await f.user.type(f.company, overrides.company ?? "Padaria Central");
  await f.user.type(f.whatsapp, "(11) 98888-7777");
  await f.user.selectOptions(f.projectType, "Sistema web sob medida");
  await f.user.type(f.message, "Controle de pedidos");
}

function openedMessage() {
  expect(openSpy).toHaveBeenCalledTimes(1);
  const [url, target, features] = openSpy.mock.calls[0];
  expect(target).toBe("_blank");
  expect(features).toBe("noopener");
  return new URL(url).searchParams.get("text");
}

describe("ContactForm", () => {
  it("bloqueia envio vazio, marca os obrigatórios, lista o que falta e foca o primeiro", async () => {
    const f = setup();

    await f.user.click(f.submit);

    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Faltam: Nome, WhatsApp, Tipo de projeto, O que você precisa.",
    );
    for (const field of [f.name, f.whatsapp, f.projectType, f.message]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription();
    }
    expect(f.company).not.toHaveAttribute("aria-invalid");
    expect(f.name).toHaveFocus();
  });

  it("foca o tipo de projeto quando ele é o primeiro pendente", async () => {
    const f = setup();
    await f.user.type(f.name, "Maria");
    await f.user.type(f.whatsapp, "11999990000");

    await f.user.click(f.submit);

    expect(f.projectType).toHaveFocus();
  });

  it("recusa WhatsApp sem DDD", async () => {
    const f = setup();
    await fillValid(f);
    await f.user.clear(f.whatsapp);
    await f.user.type(f.whatsapp, "9999-0000");

    await f.user.click(f.submit);

    expect(openSpy).not.toHaveBeenCalled();
    expect(f.whatsapp).toHaveAccessibleDescription("Informe um WhatsApp com DDD.");
  });

  it("limpa o erro do campo assim que o usuário corrige", async () => {
    const f = setup();
    await f.user.click(f.submit);
    expect(f.name).toHaveAttribute("aria-invalid", "true");

    await f.user.type(f.name, "M");

    expect(f.name).not.toHaveAttribute("aria-invalid");
    expect(f.whatsapp).toHaveAttribute("aria-invalid", "true");
  });

  it("abre o WhatsApp com a mensagem montada e mantém os dados preenchidos", async () => {
    const f = setup();
    await fillValid(f);

    await f.user.click(f.submit);

    const text = openedMessage();
    expect(text).toContain("Nome: Maria Silva");
    expect(text).toContain("Empresa: Padaria Central");
    expect(text).toContain("WhatsApp: (11) 98888-7777");
    expect(text).toContain("Tipo de projeto: Sistema web sob medida");
    expect(text).toContain("Sobre o projeto: Controle de pedidos");

    expect(screen.getByRole("status")).toHaveTextContent(/abrimos o whatsapp/i);
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    // Se o popup for bloqueado, o usuário não perde o que digitou.
    expect(f.name).toHaveValue("Maria Silva");
  });

  it("oferece link direto para o WhatsApp caso o popup seja bloqueado", async () => {
    const f = setup();
    await fillValid(f);
    await f.user.click(f.submit);

    const fallback = screen.getByRole("link", { name: /o whatsapp não abriu/i });
    expect(fallback).toHaveAttribute("href", openSpy.mock.calls[0][0]);
    expect(fallback).toHaveAttribute("target", "_blank");
  });

  it("omite a empresa da mensagem quando não informada", async () => {
    const f = setup();
    await fillValid(f, { company: "" });

    await f.user.click(f.submit);

    expect(openedMessage()).not.toContain("Empresa:");
  });

  it("o botão 'Falar no WhatsApp' aponta para wa.me e abre em nova aba", () => {
    setup();
    const link = screen.getByRole("link", { name: /falar no whatsapp/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/55\d+\?text=/));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
