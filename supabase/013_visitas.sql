-- Visitas ao site (páginas públicas), para o gráfico do /painel.
-- Sem IP e sem dado pessoal: só um id aleatório de navegador (cookie "vid"), a página e a origem.
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'America/Sao_Paulo')::date,
  visitor text not null,
  path text not null,
  source text,
  medium text,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_day_idx on public.site_visits (day);
alter table public.site_visits enable row level security;
-- Sem políticas: só o servidor (chave secreta) lê e grava.
