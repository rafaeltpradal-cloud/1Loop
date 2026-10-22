-- 1loop creators · Instagram (conexão, vídeos na biblioteca e publicação em etapas)
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

-- Vídeos na biblioteca (para reels e stories em vídeo)
alter table public.media drop constraint if exists media_kind_check;
alter table public.media add constraint media_kind_check check (kind in ('foto', 'referencia', 'video'));
alter table public.media add column if not exists mime text;
alter table public.media add column if not exists size_bytes bigint;
alter table public.media add column if not exists duration_s numeric;

-- A pasta "media" passa a aceitar vídeo (até 50 MB, o limite do plano grátis do Supabase).
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
 where id = 'media';

-- Dados extras da conta conectada (ex.: tipo de conta do Instagram)
alter table public.social_connections add column if not exists meta jsonb;

-- Referência da publicação em andamento na rede (ex.: vídeo do Instagram ainda processando)
alter table public.posts add column if not exists platform_ref text;
