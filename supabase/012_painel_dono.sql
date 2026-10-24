-- 1loop creators · painel do dono (custos lançados à mão e configurações)
-- Só o servidor lê e grava (sem políticas para usuários).

create table if not exists public.owner_costs (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'Outros',
  amount_brl numeric(12,2) not null,
  recurrence text not null default 'mensal' check (recurrence in ('mensal', 'unico')),
  start_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.owner_costs enable row level security;

create table if not exists public.owner_settings (
  id int primary key default 1 check (id = 1),
  usd_brl numeric(8,4) not null default 5.40,
  updated_at timestamptz not null default now()
);
alter table public.owner_settings enable row level security;
insert into public.owner_settings (id) values (1) on conflict (id) do nothing;
