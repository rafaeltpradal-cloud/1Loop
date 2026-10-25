-- 1loop creators · publicar em páginas de empresa do LinkedIn (conexão separada: network = 'linkedin_page').
-- Pode rodar mais de uma vez.
alter table public.social_connections drop constraint if exists social_connections_network_check;
alter table public.social_connections add constraint social_connections_network_check
  check (network in ('linkedin', 'linkedin_page', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'));
