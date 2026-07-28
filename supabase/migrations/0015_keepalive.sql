-- GPR — KEEP-ALIVE do Supabase free (evita a pausa por inatividade). Idempotente.
--
-- Ciclo pedido pelo Paulo: num dia CRIA uma empresa FICTÍCIA (dados 2025/2026/2027) vinculada ao
-- admin; no outro dia REMOVE; e assim alternando — gerando escrita+leitura+delete reais todo dia.
-- Decisão de segurança: a empresa fictícia vive numa TABELA PRÓPRIA (public.keepalive), NÃO no
-- user_data real do admin — o user_data é um blob único (last-write-wins): um job escrevendo nele
-- poderia SOBRESCREVER dados reais em uso. Aqui o ciclo é 100% isolado e não aparece no app.
-- "Limpeza": os deletes diários geram dead tuples; além do autovacuum do Supabase, um VACUUM ANALYZE
-- semanal via pg_cron mantém as tabelas do ciclo enxutas.

-- 1) Tabelas do ciclo (sem policies de API — só a função SECURITY DEFINER mexe nelas)
create table if not exists public.keepalive (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users on delete set null,
  empresa jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.keepalive enable row level security;

create table if not exists public.keepalive_log (
  id bigint generated always as identity primary key,
  acao text not null,
  at timestamptz not null default now()
);
alter table public.keepalive_log enable row level security;

-- 2) O tick do ciclo: alterna criar/remover a empresa fictícia + leitura em tabela real.
--    Throttle de 1h (chamadas repetidas não fazem nada) — a RPC é exposta ao anon só p/ o job diário.
create or replace function public.keepalive_tick() returns text
language plpgsql security definer set search_path = public as $$
declare n int; adm uuid; contas int; msg text;
begin
  if exists (select 1 from keepalive_log where at > now() - interval '1 hour') then
    return 'throttled (aguarde 1h entre ciclos)';
  end if;
  select count(*) into n from keepalive;
  select id into adm from profiles where is_admin order by created_at limit 1;
  select count(*) into contas from user_data;   -- leitura em tabela real (atividade de read)
  if n > 0 then
    delete from keepalive;
    msg := 'empresa fictícia REMOVIDA (ciclo ok; ' || contas || ' contas com dados)';
  else
    insert into keepalive (owner_id, empresa) values (adm, jsonb_build_object(
      'nome', 'GPR Keepalive (empresa fictícia)',
      'cnpj', '00.000.000/0000-00',
      'anos', jsonb_build_array(2025, 2026, 2027),
      'vendas', (select jsonb_agg(jsonb_build_object(
        'dataVenda', to_char(d, 'YYYY-MM-DD'), 'dataVencimento', to_char(d, 'YYYY-MM-DD'),
        'dataRecebimento', case when d < now() then to_char(d, 'YYYY-MM-DD') else '' end,
        'valor', 1000 + (random() * 9000)::int, 'cliente', 'Cliente Fictício', 'produto', 'Produto Fictício', 'canal', 'Keepalive'))
        from generate_series('2025-01-15'::timestamptz, '2027-12-15', interval '1 month') d),
      'despesas', (select jsonb_agg(jsonb_build_object(
        'dataVencimento', to_char(d, 'YYYY-MM-DD'),
        'pagoEm', case when d < now() then to_char(d, 'YYYY-MM-DD') else '' end,
        'valor', 500 + (random() * 4500)::int, 'descricao', 'Despesa fictícia', 'categoria', 'Keepalive'))
        from generate_series('2025-01-10'::timestamptz, '2027-12-10', interval '1 month') d)
    ));
    msg := 'empresa fictícia CRIADA (36 vendas + 36 despesas, 2025–2027; ' || contas || ' contas com dados)';
  end if;
  insert into keepalive_log (acao) values (msg);
  delete from keepalive_log where at < now() - interval '30 days';   -- log não cresce sem limite
  return msg;
end $$;
revoke all on function public.keepalive_tick() from public;
grant execute on function public.keepalive_tick() to anon, authenticated;

-- 3) pg_cron: redundância interna (se o job externo falhar, o ciclo continua) + manutenção semanal.
create extension if not exists pg_cron;
do $$ begin
  begin perform cron.unschedule('gpr-keepalive-tick'); exception when others then null; end;
  begin perform cron.unschedule('gpr-keepalive-vacuum'); exception when others then null; end;
end $$;
select cron.schedule('gpr-keepalive-tick', '17 3 * * *', $$select public.keepalive_tick()$$);
select cron.schedule('gpr-keepalive-vacuum', '0 4 * * 0', $$vacuum analyze public.keepalive, public.keepalive_log$$);
