-- Cofrin: notificações
create table if not exists public.cofrin_push (
  endpoint text primary key,
  email    text not null,
  sub      jsonb not null,
  criado   timestamptz default now()
);
alter table public.cofrin_push enable row level security;
drop policy if exists "push dos liberados" on public.cofrin_push;
create policy "push dos liberados" on public.cofrin_push for all to authenticated
  using (public.cofrin_liberado())
  with check (public.cofrin_liberado() and email = (auth.jwt() ->> 'email'));

-- chaves internas (só o servidor lê)
create table if not exists public.cofrin_segredos (id text primary key, valor jsonb not null);
alter table public.cofrin_segredos enable row level security;
revoke all on public.cofrin_segredos from anon, authenticated;

-- agendamentos: 9h todo dia e domingo 20h (horário do Paraguai, UTC-3)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.unschedule(jobname) from cron.job where jobname in ('cofrin-manha', 'cofrin-semana');
select cron.schedule('cofrin-manha', '0 12 * * *', $c$
  select net.http_post(
    url := 'https://thsdxhvikpuhfzcohano.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select valor->>'token' from public.cofrin_segredos where id = 'cron')),
    body := '{"acao":"manha"}'::jsonb)
$c$);
select cron.schedule('cofrin-semana', '0 23 * * 0', $c$
  select net.http_post(
    url := 'https://thsdxhvikpuhfzcohano.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select valor->>'token' from public.cofrin_segredos where id = 'cron')),
    body := '{"acao":"semana"}'::jsonb)
$c$);
