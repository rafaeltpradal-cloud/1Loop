-- 1loop creators · foto de perfil e pacotes extras de posts
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

-- Foto de perfil -------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
grant update (avatar_url) on public.profiles to authenticated;

-- Pasta pública "avatars": cada usuário só mexe na própria pasta (<id do usuário>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar: ver a própria pasta" on storage.objects;
create policy "avatar: ver a própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar: enviar na própria pasta" on storage.objects;
create policy "avatar: enviar na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar: trocar na própria pasta" on storage.objects;
create policy "avatar: trocar na própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar: apagar da própria pasta" on storage.objects;
create policy "avatar: apagar da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Pacotes extras (pagamento único) ------------------------------------------
create table if not exists public.extra_packs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  posts int not null,
  amount int not null default 0, -- em centavos
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists extra_packs_user_idx on public.extra_packs (user_id);

alter table public.extra_packs enable row level security;
-- Só leitura para o usuário. Quem grava é o servidor, depois de confirmar o pagamento no Stripe.
revoke insert, update, delete on public.extra_packs from authenticated, anon;
drop policy if exists "pacotes: ler os próprios" on public.extra_packs;
create policy "pacotes: ler os próprios" on public.extra_packs for select using (auth.uid() = user_id);
