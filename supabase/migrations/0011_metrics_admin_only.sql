-- GPR — Segurança: metrics_counts SÓ para admin.
-- Antes, a função (security definer) só revogava execução de `anon`, então QUALQUER usuário
-- autenticado (inclusive demo/grátis) recebia as contagens globais (usuários/assinantes/contas)
-- ao abrir #admin. Agora a própria função filtra por is_admin(): não-admin recebe 0 linhas
-- (o painel mostra 0) — sem vazar números do negócio. Idempotente.
create or replace function public.metrics_counts() returns table(usuarios bigint, assinantes bigint, contas bigint)
language sql security definer set search_path = public as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.subscriptions where status in ('active','trialing')),
    (select count(*) from public.user_data)
  where public.is_admin();   -- não-admin → 0 linhas → painel exibe 0, sem vazar contagem
$$;
revoke execute on function public.metrics_counts() from anon;
