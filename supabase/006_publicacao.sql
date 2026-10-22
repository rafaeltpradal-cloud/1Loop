-- 1loop creators · conexão oficial com as redes e publicação agendada (começa pelo LinkedIn)
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

-- Conexões autorizadas pela rede. O token fica criptografado e só o servidor lê (sem políticas de acesso).
create table if not exists public.social_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  network text not null check (network in ('linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads')),
  external_id text not null,          -- id da pessoa na rede (no LinkedIn, o "sub")
  name text,
  picture text,
  access_token text not null,         -- criptografado (AES-256-GCM)
  scopes text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, network)
);
alter table public.social_connections enable row level security;
revoke all on public.social_connections from authenticated, anon;

-- Agendamento nos posts
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.posts add column if not exists external_url text;
alter table public.posts add column if not exists publish_error text;
alter table public.posts add column if not exists assets jsonb;   -- imagens prontas para publicar: [{ path, w, h }]

alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check
  check (status in ('rascunho', 'aprovado', 'agendado', 'publicando', 'publicado', 'erro'));
create index if not exists posts_due_idx on public.posts (scheduled_at) where status = 'agendado';

-- Agendador: a cada 5 minutos o banco chama o publicador do site.
-- O publicador só publica o que já está agendado e venceu, então não precisa de senha.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = '1loop-publicar';
select cron.schedule(
  '1loop-publicar',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://1loopcreators.com.br/api/publicar',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 55000
     ) $$
);
