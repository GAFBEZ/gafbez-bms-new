-- Branches: the physical GAFBEZ Energies locations. Referenced by the
-- branch selector in the dashboard header. "All Branches" is a UI-only
-- concept (no filter applied) and is intentionally not a row here.

create table if not exists public.branches (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'coming_soon')),
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;

-- Foundation stage: no auth yet, so allow anyone to read branches.
-- This policy will be tightened once staff accounts and roles exist.
create policy "Branches are readable by anyone"
  on public.branches
  for select
  to anon, authenticated
  using (true);

insert into public.branches (id, name, status)
values
  ('abuja', 'GAFBEZ Energies Abuja Branch', 'active'),
  ('minna', 'GAFBEZ Energies Minna Branch', 'active'),
  ('ilorin', 'GAFBEZ Energies Ilorin Branch', 'coming_soon')
on conflict (id) do nothing;
