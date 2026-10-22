-- 1loop creators · fotos e referências enviadas pelo usuário (área "Conteúdos > Fotos")
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

create table if not exists public.media (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null unique,          -- caminho no bucket "media": <id do usuário>/<arquivo>
  kind text not null default 'foto' check (kind in ('foto', 'referencia')),
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index if not exists media_user_idx on public.media (user_id, created_at desc);

alter table public.media enable row level security;
drop policy if exists "media: ler as próprias" on public.media;
create policy "media: ler as próprias" on public.media for select using (auth.uid() = user_id);
drop policy if exists "media: criar as próprias" on public.media;
create policy "media: criar as próprias" on public.media for insert with check (auth.uid() = user_id);
drop policy if exists "media: editar as próprias" on public.media;
create policy "media: editar as próprias" on public.media for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "media: apagar as próprias" on public.media;
create policy "media: apagar as próprias" on public.media for delete using (auth.uid() = user_id);

-- Pasta privada "media": cada usuário só vê e mexe na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: ver a própria pasta" on storage.objects;
create policy "media: ver a própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media: enviar na própria pasta" on storage.objects;
create policy "media: enviar na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media: apagar da própria pasta" on storage.objects;
create policy "media: apagar da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
