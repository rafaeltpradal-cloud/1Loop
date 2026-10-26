-- 1loop creators · eventos da landing (clique nos botões e quanto a pessoa rolou), para achar onde ela desiste.
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'America/Sao_Paulo')::date,
  visitor text not null,
  path text not null,
  event text not null,   -- 'cta' | 'scroll50' | 'scroll90' | 'plano'
  detail text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists site_events_day on public.site_events (day);
alter table public.site_events enable row level security;
revoke all on public.site_events from authenticated, anon;
