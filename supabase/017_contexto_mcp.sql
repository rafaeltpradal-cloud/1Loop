-- 1loop creators · contexto do perfil + conexão com IAs (MCP)
-- Contexto: fatos, números, cases, histórias e opiniões que a pessoa registra (no app ou pela IA dela, via MCP).
-- A geração de posts usa esse contexto como base real. Rode em: Supabase > SQL Editor. Pode rodar mais de uma vez.

create table if not exists public.user_context (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id bigint references public.brands (id) on delete cascade,
  tipo text not null default 'fato' check (tipo in ('sobre', 'fato', 'numero', 'case', 'historia', 'opiniao', 'oferta', 'publico', 'outro')),
  titulo text check (titulo is null or char_length(titulo) <= 120),
  texto text not null check (char_length(texto) between 1 and 4000),
  fonte text not null default 'app' check (fonte in ('app', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_context_user_idx on public.user_context (user_id, brand_id, created_at desc);
alter table public.user_context enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_context' and policyname = 'contexto: o próprio') then
    create policy "contexto: o próprio" on public.user_context for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Links de conexão MCP (Claude, ChatGPT, Cursor…). Guardamos só o hash do token; só o servidor lê.
create table if not exists public.mcp_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id bigint references public.brands (id) on delete cascade,
  token_hash text not null unique,
  hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id, created_at desc);
alter table public.mcp_tokens enable row level security;
