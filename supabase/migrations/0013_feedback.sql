-- GPR — Feedback/sugestões dos usuários (modo teste). Idempotente. Aplicada via Management API.
-- RLS: cada usuário INSERE e LÊ só os seus; ADMIN lê todos e atualiza o status.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null default 'sugestao',           -- sugestao | melhoria | problema | duvida
  mensagem text not null,
  tela text,                                        -- tela/rota de onde veio (opcional)
  status text not null default 'novo',              -- novo | lido | resolvido (admin gerencia)
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert with check (owner_id = auth.uid());

drop policy if exists feedback_admin_upd on public.feedback;
create policy feedback_admin_upd on public.feedback for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists feedback_admin_del on public.feedback;
create policy feedback_admin_del on public.feedback for delete using (public.is_admin());

create index if not exists feedback_created_idx on public.feedback (created_at desc);
