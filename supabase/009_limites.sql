-- 1loop creators · limites de uso da IA
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

-- Post que usou 1 dos posts extras comprados em pacote (passou da cota do mês).
alter table public.posts add column if not exists extra boolean not null default false;

create index if not exists posts_brand_created_idx on public.posts (brand_id, created_at);
create index if not exists strategies_brand_created_idx on public.strategies (brand_id, created_at);
