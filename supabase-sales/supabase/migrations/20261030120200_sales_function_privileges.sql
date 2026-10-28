-- Correção de segurança (encontrada pelos testes da Fase 3, antes de produção).
--
-- No Postgres, toda função nova nasce com EXECUTE para PUBLIC. O
-- "alter default privileges in schema ... revoke" da Fase 1 não remove esse
-- padrão global (privilégios por schema só acrescentam), então as funções
-- criadas nas Fases 2 e 3 ficaram executáveis por anon e authenticated —
-- inclusive whatsapp_get_access_token (lê o token da Meta),
-- whatsapp_record_inbound e whatsapp_apply_status.
--
-- Aqui: (1) remove o padrão global para funções futuras; (2) revoga PUBLIC
-- de todas as funções existentes; (3) concede de novo só o que cada papel
-- precisa. O teste "privilégios de funções" garante que isso não volte.

alter default privileges revoke execute on functions from public;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Só o servidor (secret key): leitura de segredo, processamento de webhook,
-- consumo, plataforma e limite de tentativas.
revoke execute on function
  public.whatsapp_get_access_token(uuid),
  public.whatsapp_record_inbound(text, text, text, text, text, text, jsonb, timestamptz, public.message_sender),
  public.whatsapp_apply_status(text, public.message_status, timestamptz, jsonb, jsonb),
  public.platform_create_organization(uuid, text, text, text, text, text, text, text, text),
  public.platform_set_organization_status(uuid, uuid, public.org_status, text),
  public.platform_invite_owner(uuid, uuid, text, text, text),
  public.effective_limit(uuid, text),
  public.reserve_usage(uuid, text, numeric, text, integer),
  public.settle_usage(uuid, uuid, numeric, text, uuid),
  public.release_usage(uuid, uuid),
  public.consume_rate_limit(text, integer, integer)
  from authenticated;

-- Helpers usados pelas policies (avaliadas com o papel de quem consulta).
grant execute on function
  private.org_role(uuid), private.is_member(uuid), private.has_org_role(uuid, public.org_role),
  private.is_listed_member(uuid), private.shares_org_with(uuid), private.is_service_role(),
  private.can_see_lead(uuid, uuid), private.can_read_conversations(uuid)
  to authenticated, service_role;

-- Funções chamadas com a sessão do usuário (cada uma confere o papel).
grant execute on function
  public.create_invite(uuid, text, public.org_role, text),
  public.accept_invite(text),
  public.import_contacts(uuid, text, text, uuid, jsonb, boolean, boolean, jsonb),
  public.record_export(uuid, text, integer, jsonb),
  public.crm_dashboard(uuid, timestamptz, timestamptz),
  public.whatsapp_set_access_token(uuid, uuid, text),
  public.whatsapp_send_gate(uuid, uuid, uuid, public.send_kind, public.send_origin, text, text, uuid, public.consent_purpose, boolean),
  public.whatsapp_opt_out(uuid, uuid, text)
  to authenticated;

-- Única função pública: prévia do convite (o token é o segredo).
grant execute on function public.get_invite_preview(text) to anon, authenticated;

grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- Nome de template: o limite {1,512} estoura o máximo de repetição de regex do Postgres.
alter table public.whatsapp_templates drop constraint whatsapp_templates_name_check;
alter table public.whatsapp_templates add constraint whatsapp_templates_name_check check (char_length(name) between 1 and 512 and name ~ '^[a-z0-9_]+$');
