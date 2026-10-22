-- 1loop creators · conteúdos gerados (área "Conteúdos")
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  strategy_id bigint not null references public.strategies (id) on delete cascade,
  item_index int not null,            -- posição do post no calendário da estratégia
  date date not null,                 -- dia de publicação
  rede text not null,
  formato text not null,
  pilar int not null default 0,
  objetivo text not null default '',
  com_rosto boolean not null default false,
  tema text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'publicado')),
  content jsonb not null,
  versions int not null default 1,    -- quantas vezes foi gerado
  source text not null default 'ai' check (source in ('ai', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (strategy_id, item_index)
);
create index if not exists posts_user_date_idx on public.posts (user_id, date);

alter table public.posts enable row level security;
-- Só leitura para o usuário. Gerar, editar e aprovar passa pelo servidor, sempre filtrando pelo dono.
revoke insert, update, delete on public.posts from authenticated, anon;
drop policy if exists "posts: ler os próprios" on public.posts;
create policy "posts: ler os próprios" on public.posts for select using (auth.uid() = user_id);
