-- 1loop creators · origem do cadastro (UTMs e ids de clique dos anúncios)
alter table public.profiles add column if not exists origem jsonb;
