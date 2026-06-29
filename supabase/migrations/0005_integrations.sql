-- GPR — Integrações (chaves de Resend/Green geridas no GPR Core). SÓ-ADMIN (são segredos).
-- O Edge Function (service_role) lê esta tabela (bypassa RLS). Idempotente.
create table if not exists public.integrations (
  key text primary key,
  value text default '',
  updated_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
-- Sem policy de leitura para não-admin → apenas admin lê/escreve (segredos protegidos).
drop policy if exists integrations_admin on public.integrations;
create policy integrations_admin on public.integrations for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists set_updated_at on public.integrations;
create trigger set_updated_at before update on public.integrations for each row execute function public.tg_set_updated_at();
insert into public.integrations (key) values
  ('resend_api_key'), ('from_email'), ('app_url'), ('green_webhook_secret')
on conflict (key) do nothing;
