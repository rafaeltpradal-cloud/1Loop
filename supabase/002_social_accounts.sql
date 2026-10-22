-- 1loop creators · perfis das redes sociais (etapa "Redes")
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

create table if not exists public.social_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  network text not null check (network in ('instagram', 'linkedin', 'tiktok', 'youtube', 'facebook', 'threads')),
  handle text not null,
  -- 'pending' = perfil cadastrado; 'connected' = autorizado pela rede (gravado só pelo servidor).
  status text not null default 'pending' check (status in ('pending', 'connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, network)
);

alter table public.social_accounts enable row level security;

-- O usuário cadastra, edita e remove só os próprios perfis, e não pode mudar o status.
revoke insert, update on public.social_accounts from authenticated;
grant insert (user_id, network, handle, updated_at) on public.social_accounts to authenticated;
grant update (user_id, network, handle, updated_at) on public.social_accounts to authenticated;

drop policy if exists "redes: ler as próprias" on public.social_accounts;
create policy "redes: ler as próprias" on public.social_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "redes: criar as próprias" on public.social_accounts;
create policy "redes: criar as próprias" on public.social_accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "redes: editar as próprias" on public.social_accounts;
create policy "redes: editar as próprias" on public.social_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "redes: remover as próprias" on public.social_accounts;
create policy "redes: remover as próprias" on public.social_accounts
  for delete using (auth.uid() = user_id);
