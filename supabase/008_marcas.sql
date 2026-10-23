-- 1loop creators · marcas (no plano Multi, cada marca tem entrevista, estratégia, conteúdos, redes e biblioteca próprias)
-- Rode em: Supabase > SQL Editor > New query > Run. Pode rodar mais de uma vez.

create table if not exists public.brands (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brands_user_idx on public.brands (user_id, created_at);
alter table public.brands enable row level security;
drop policy if exists "marcas: ler as próprias" on public.brands;
create policy "marcas: ler as próprias" on public.brands for select using (auth.uid() = user_id);

-- Marca padrão: a primeira da pessoa (cria uma se ainda não tiver).
create or replace function public.default_brand(uid uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare bid bigint;
begin
  select id into bid from public.brands where user_id = uid order by created_at, id limit 1;
  if bid is null then
    insert into public.brands (user_id, name)
    values (uid, coalesce(nullif((select name from public.profiles where id = uid), ''), 'Minha marca'))
    returning id into bid;
  end if;
  return bid;
end $$;

-- Se algo for gravado sem marca, vai para a marca padrão da pessoa.
create or replace function public.fill_brand_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brand_id is null then new.brand_id := public.default_brand(new.user_id); end if;
  return new;
end $$;

-- Uma marca por pessoa para o que já existe
select public.default_brand(id) from auth.users;

do $$
declare t text;
begin
  foreach t in array array['interviews', 'strategies', 'posts', 'social_accounts', 'social_connections', 'media'] loop
    execute format('alter table public.%I add column if not exists brand_id bigint references public.brands (id) on delete cascade', t);
    execute format('update public.%I x set brand_id = public.default_brand(x.user_id) where brand_id is null', t);
    execute format('drop trigger if exists %I on public.%I', t || '_brand', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.fill_brand_id()', t || '_brand', t);
    execute format('alter table public.%I alter column brand_id set not null', t);
  end loop;
end $$;

-- Entrevista: uma por marca
alter table public.interviews drop constraint if exists interviews_pkey;
alter table public.interviews add primary key (brand_id);
create index if not exists interviews_user_idx on public.interviews (user_id);

-- Perfis e conexões: um por rede em cada marca
alter table public.social_accounts drop constraint if exists social_accounts_user_id_network_key;
alter table public.social_accounts drop constraint if exists social_accounts_brand_network_key;
alter table public.social_accounts add constraint social_accounts_brand_network_key unique (brand_id, network);
alter table public.social_connections drop constraint if exists social_connections_pkey;
alter table public.social_connections add primary key (brand_id, network);

create index if not exists strategies_brand_idx on public.strategies (brand_id, created_at desc);
create index if not exists posts_brand_idx on public.posts (brand_id);
create index if not exists media_brand_idx on public.media (brand_id, created_at desc);

-- Quem cadastra o próprio @ pelo navegador também informa a marca
grant insert (brand_id) on public.social_accounts to authenticated;
