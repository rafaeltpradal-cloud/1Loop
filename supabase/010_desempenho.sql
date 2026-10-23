-- 1loop creators · desempenho (números dos posts e do perfil)
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

-- Números de cada post. Do Instagram vêm sozinhos (API); do LinkedIn, a pessoa anota.
create table if not exists public.post_metrics (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id bigint not null references public.brands (id) on delete cascade,
  post_id bigint references public.posts (id) on delete set null,   -- quando o post saiu pelo 1loop
  network text not null,
  external_id text not null,          -- id do post na rede (ou "post:<id>" quando anotado à mão)
  permalink text,
  caption text,
  media_type text,
  thumb_url text,
  posted_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,   -- views, reach, likes, comments, saved, shares, interactions, impressions
  source text not null default 'api' check (source in ('api', 'manual')),
  updated_at timestamptz not null default now(),
  unique (brand_id, network, external_id)
);
create index if not exists post_metrics_brand_idx on public.post_metrics (brand_id, posted_at desc);
alter table public.post_metrics enable row level security;
drop policy if exists "desempenho: ler os próprios" on public.post_metrics;
create policy "desempenho: ler os próprios" on public.post_metrics for select using (auth.uid() = user_id);

-- Uma foto por dia dos números de cada post (para ver a curva).
create table if not exists public.post_metric_history (
  post_metric_id bigint not null references public.post_metrics (id) on delete cascade,
  day date not null,
  metrics jsonb not null,
  primary key (post_metric_id, day)
);
alter table public.post_metric_history enable row level security;

-- Números do perfil por dia (seguidores e alcance).
create table if not exists public.account_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id bigint not null references public.brands (id) on delete cascade,
  network text not null,
  day date not null,
  followers int,
  reach int,
  updated_at timestamptz not null default now(),
  primary key (brand_id, network, day)
);
alter table public.account_metrics enable row level security;
drop policy if exists "perfil: ler os próprios" on public.account_metrics;
create policy "perfil: ler os próprios" on public.account_metrics for select using (auth.uid() = user_id);

-- Coleta diária às 06:10 (horário de Brasília = 09:10 UTC).
select cron.unschedule(jobid) from cron.job where jobname = '1loop-desempenho';
select cron.schedule(
  '1loop-desempenho',
  '10 9 * * *',
  $$ select net.http_post(
       url := 'https://1loopcreators.com.br/api/desempenho/sync',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 55000
     ) $$
);
