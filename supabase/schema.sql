-- 1loop creators · estrutura do banco (Supabase)
-- Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run.

-- =========================================================
-- Perfis (1 por usuário do Supabase Auth)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "perfil: ler o próprio" on public.profiles
  for select using (auth.uid() = id);

-- O usuário só pode editar nome e telefone. O stripe_customer_id é gravado pelo servidor.
revoke update on public.profiles from authenticated;
grant update (name, phone) on public.profiles to authenticated;
create policy "perfil: editar o próprio" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Cria o perfil automaticamente no cadastro, com nome e telefone enviados no signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (new.id, new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Assinaturas (espelho do Stripe, gravado pelo webhook)
-- =========================================================
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text check (plan in ('basic', 'pro', 'multi')),
  status text not null,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);

alter table public.subscriptions enable row level security;
-- Somente leitura para o usuário. Escrita apenas pelo servidor (service role).
create policy "assinatura: ler a própria" on public.subscriptions
  for select using (auth.uid() = user_id);

-- =========================================================
-- Entrevista (respostas do onboarding)
-- =========================================================
create table if not exists public.interviews (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.interviews enable row level security;
create policy "entrevista: ler a própria" on public.interviews
  for select using (auth.uid() = user_id);
create policy "entrevista: criar a própria" on public.interviews
  for insert with check (auth.uid() = user_id);
create policy "entrevista: editar a própria" on public.interviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- Estratégias geradas (histórico; a mais recente é a ativa)
-- =========================================================
create table if not exists public.strategies (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null,
  source text not null check (source in ('ai', 'demo')),
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists strategies_user_idx on public.strategies (user_id, created_at desc);

alter table public.strategies enable row level security;
create policy "estratégia: ler as próprias" on public.strategies
  for select using (auth.uid() = user_id);
create policy "estratégia: criar as próprias" on public.strategies
  for insert with check (auth.uid() = user_id);
