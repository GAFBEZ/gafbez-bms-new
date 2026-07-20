-- Inventory Master: the product catalog. Stock is a single aggregate
-- quantity for now (not yet split per branch) -- proper per-branch stock
-- ledgers belong to the future Stock Movement module.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  unit text not null default 'unit',
  cost_price numeric(14, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  quantity_in_stock integer not null default 0 check (quantity_in_stock >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- No role enforcement yet (see README) -- any signed-in staff member has
-- full access. Tighten to admin-only writes once profiles.role is enforced.
create policy "Authenticated users can read products"
  on public.products
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert products"
  on public.products
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update products"
  on public.products
  for update
  to authenticated
  using (true);

create policy "Authenticated users can delete products"
  on public.products
  for delete
  to authenticated
  using (true);

create function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

insert into public.products
  (sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level)
values
  ('SP-150W-MONO', '150W Monocrystalline Solar Panel', 'Solar Panels', 'unit', 45000, 62000, 120, 20),
  ('BAT-200AH-LI', '200Ah Lithium Battery', 'Batteries', 'unit', 380000, 495000, 18, 10),
  -- Intentionally at/below reorder level so a fresh install demonstrates
  -- the low-stock badge without manual editing.
  ('INV-5KVA-HYB', '5kVA Hybrid Inverter', 'Inverters', 'unit', 620000, 810000, 7, 8),
  ('CTRL-60A-MPPT', '60A MPPT Charge Controller', 'Charge Controllers', 'unit', 85000, 115000, 14, 6),
  ('CONN-MC4-PAIR', 'MC4 Connector Pair', 'Accessories', 'pack', 800, 1500, 640, 100)
on conflict (sku) do nothing;
