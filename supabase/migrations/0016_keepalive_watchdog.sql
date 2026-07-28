-- GPR — WATCHDOG do keep-alive: avisa por e-mail se a movimentação parar. Idempotente.
-- Camada 1 (funciona já): RPC keepalive_health() consultada por um workflow SEMANAL do GitHub —
--   se o último ciclo tiver >48h, o workflow FALHA de propósito e o GitHub manda e-mail nativo ao Paulo.
-- Camada 2 (interna): função diária via pg_cron que, se o ciclo parar OU o GitHub sumir por 72h,
--   manda e-mail via Resend (pg_net). DEGRADA SEM QUEBRAR se o Resend não estiver configurado
--   (integrations.resend_api_key vazio) — hoje está vazio; ao configurar no GPR Core, passa a enviar.

-- Origem do tick no log (api = GitHub/REST; interno = pg_cron) p/ detectar o GitHub parado.
alter table public.keepalive_log add column if not exists origem text not null default 'api';

create or replace function public.keepalive_tick() returns text
language plpgsql security definer set search_path = public as $$
declare n int; adm uuid; contas int; msg text; org text;
begin
  org := case when current_setting('request.jwt.claims', true) is null then 'interno' else 'api' end;
  if exists (select 1 from keepalive_log where origem in ('api','interno') and at > now() - interval '1 hour') then
    return 'throttled (aguarde 1h entre ciclos)';
  end if;
  select count(*) into n from keepalive;
  select id into adm from profiles where is_admin order by created_at limit 1;
  select count(*) into contas from user_data;
  if n > 0 then
    delete from keepalive where id is not null;
    msg := 'empresa fictícia REMOVIDA (ciclo ok; ' || contas || ' contas com dados)';
  else
    insert into keepalive (owner_id, empresa) values (adm, jsonb_build_object(
      'nome', 'GPR Keepalive (empresa fictícia)', 'cnpj', '00.000.000/0000-00',
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
  insert into keepalive_log (acao, origem) values (msg, org);
  delete from keepalive_log where at < now() - interval '30 days';
  return msg;
end $$;
revoke all on function public.keepalive_tick() from public;
grant execute on function public.keepalive_tick() to anon, authenticated;

-- Saúde do ciclo (consumida pelo watchdog do GitHub).
create or replace function public.keepalive_health() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'ultimo_ciclo_horas', round(extract(epoch from (now() - max(at))) / 3600.0, 1),
    'ultimo_api_horas',   round(extract(epoch from (now() - max(at) filter (where origem = 'api'))) / 3600.0, 1),
    'ultimo_interno_horas', round(extract(epoch from (now() - max(at) filter (where origem = 'interno'))) / 3600.0, 1),
    'logs_30d', count(*))
  from keepalive_log where origem in ('api','interno');
$$;
revoke all on function public.keepalive_health() from public;
grant execute on function public.keepalive_health() to anon, authenticated;

-- Watchdog interno: e-mail via Resend (se configurado) quando o ciclo para (>48h) ou o GitHub some (>72h).
create extension if not exists pg_net;
create or replace function public.keepalive_watchdog() returns text
language plpgsql security definer set search_path = public as $$
declare h jsonb; problema text := ''; rkey text; rfrom text; rto text;
begin
  select public.keepalive_health() into h;
  if coalesce((h->>'ultimo_ciclo_horas')::numeric, 9999) > 48 then
    problema := 'O ciclo de keep-alive NÃO roda há ' || coalesce(h->>'ultimo_ciclo_horas','?') || ' horas (GitHub e pg_cron parados?).';
  elsif coalesce((h->>'ultimo_api_horas')::numeric, 9999) > 72 then
    problema := 'O job do GitHub Actions não chama a API há ' || coalesce(h->>'ultimo_api_horas','?') || ' horas (cron desativado por inatividade do repo?). O ciclo interno segue rodando.';
  end if;
  if problema = '' then return 'ok'; end if;
  if exists (select 1 from keepalive_log where origem = 'alerta' and at > now() - interval '24 hours') then
    return 'alerta já enviado nas últimas 24h';
  end if;
  insert into keepalive_log (acao, origem) values (problema, 'alerta');
  select value into rkey from integrations where key = 'resend_api_key';
  select value into rfrom from integrations where key = 'from_email';
  select email into rto from profiles where is_admin order by created_at limit 1;
  if coalesce(rkey, '') = '' or coalesce(rto, '') = '' then
    return 'ALERTA registrado no log, MAS sem e-mail (Resend não configurado em Integrações)';
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || rkey, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', coalesce(nullif(rfrom, ''), 'GPR <onboarding@resend.dev>'),
      'to', rto,
      'subject', '⚠️ GPR: keep-alive do Supabase parado',
      'html', '<p><strong>Aviso do watchdog do GPR:</strong></p><p>' || problema || '</p><p>Veja a aba Actions do repo bragarpaulo/GPR e o log em public.keepalive_log.</p>'));
  return 'ALERTA enviado por e-mail para ' || rto;
end $$;
revoke all on function public.keepalive_watchdog() from public;

do $$ begin
  begin perform cron.unschedule('gpr-keepalive-watchdog'); exception when others then null; end;
end $$;
select cron.schedule('gpr-keepalive-watchdog', '0 13 * * *', $$select public.keepalive_watchdog()$$);
