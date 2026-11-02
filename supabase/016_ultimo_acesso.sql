-- 1loop creators · último acesso ao app (para o painel do dono saber quem está usando de verdade).
-- Gravado pelo servidor no máximo a cada 30 minutos por pessoa. Pode rodar mais de uma vez.
alter table public.profiles add column if not exists last_seen_at timestamptz;
