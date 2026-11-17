-- Cofrin: cole tudo isto no Supabase > SQL Editor > New query > Run

-- 1) Tabela onde ficam os dados (um registro por mês + um de configuração)
create table if not exists public.cofrin (
  id         text primary key,          -- ex: 'meses/2026-11' ou 'config/geral'
  data       jsonb not null,
  updated_at timestamptz default now()
);

-- 2) Liga a "tranca": ninguém lê nem grava sem permissão
alter table public.cofrin enable row level security;

-- 3) Lista de quem pode entrar (troque pelos e-mails que você criar)
create or replace function public.cofrin_liberado() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'fernando@cofrin.app', 'fernando@cofre.app',
    'luiza@cofrin.app',    'luiza@cofre.app',
    'luiz@cofre.app',      'luiz@cofrin.app'
  );
$$;

-- 4) Só quem está na lista acessa os dados
drop policy if exists "so liberados" on public.cofrin;
create policy "so liberados" on public.cofrin
  for all to authenticated
  using (public.cofrin_liberado())
  with check (public.cofrin_liberado());
