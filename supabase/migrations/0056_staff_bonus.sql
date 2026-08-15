-- Monthly staff bonus scheme: a fixed Naira amount per unit sold, set
-- separately for solar panels, inverters, and batteries. Two new pieces:
--
-- 1. products.bonus_category -- a NEW, separate tag from the existing
--    free-text `category` column. That column has no fixed list and is
--    used for general browsing/inventory grouping (e.g. "Lithium
--    Battery" vs "Battery" vs "5kWh Battery" could all mean the same
--    thing to a person but not to a WHERE clause). bonus_category is
--    deliberately a small, fixed set (checked against exactly 3 values)
--    so bonus reporting never silently drops a product due to
--    inconsistent free-text naming. Null means "doesn't earn a bonus"
--    (accessories, cables, etc.) -- the default for every existing
--    product until an admin tags it via the Inventory Master edit form.
--
-- 2. bonus_rates -- one row per category, admin-editable Naira-per-unit
--    rate. Same "small config table gated by RLS, not an RPC" pattern as
--    app_settings (0012_app_settings.sql) -- a plain authenticated
--    update from the Server Action, enforced by the update policy
--    below, no wrapper function needed for a single-column edit.
--
-- A sale only counts toward bonus once its status is 'paid' (business
-- decision -- stock leaving the shop on credit doesn't earn a bonus
-- until the balance is actually collected). That's enforced in the
-- application query (src/lib/staffBonus.ts), not here, same as every
-- other sales report in this codebase (see salesTracker.ts).

alter table public.products
  add column bonus_category text check (bonus_category in ('solar_panel', 'inverter', 'battery'));

comment on column public.products.bonus_category is 'Which staff-bonus bucket this product counts toward, independent of the free-text `category` column. Null means this product never earns a bonus.';

create table public.bonus_rates (
  category text primary key check (category in ('solar_panel', 'inverter', 'battery')),
  amount_per_item numeric(14, 2) not null default 0 check (amount_per_item >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.bonus_rates is 'Admin-editable Naira-per-unit bonus rate for each of the 3 bonus categories -- see products.bonus_category. Exactly 3 rows always exist (seeded below); the category check constraint prevents a 4th.';

insert into public.bonus_rates (category) values ('solar_panel'), ('inverter'), ('battery');

alter table public.bonus_rates enable row level security;

create policy "Authenticated users can read bonus rates"
  on public.bonus_rates
  for select
  to authenticated
  using (true);

create policy "Only admins can update bonus rates"
  on public.bonus_rates
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- create_product()/update_product() both gain a p_bonus_category param --
-- a changed signature is a different function as far as Postgres is
-- concerned, so (same technique 0024_product_supplier.sql used to add
-- p_supplier) the old overloads must be dropped explicitly and grants
-- restated.
drop function if exists public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text);
drop function if exists public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text);

create function public.create_product(
  p_sku text,
  p_name text,
  p_category text,
  p_unit text,
  p_cost_price numeric,
  p_selling_price numeric,
  p_quantity_in_stock integer,
  p_reorder_level integer,
  p_is_active boolean,
  p_branch_id text,
  p_supplier text default null,
  p_bonus_category text default null
)
returns public.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Only admins can add products';
  end if;

  insert into public.products
    (sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, is_active, supplier, bonus_category)
  values
    (p_sku, p_name, p_category, p_unit, p_cost_price, p_selling_price, 0, p_reorder_level, p_is_active, p_supplier, p_bonus_category)
  returning * into v_product;

  if p_quantity_in_stock > 0 then
    insert into public.product_stock (product_id, branch_id, quantity)
    values (v_product.id, p_branch_id, p_quantity_in_stock)
    on conflict (product_id, branch_id) do update
      set quantity = public.product_stock.quantity + excluded.quantity;

    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (v_product.id, p_branch_id, 'in', p_quantity_in_stock, 'Initial stock (new product)', auth.uid());

    select * into v_product from public.products where id = v_product.id;
  end if;

  return v_product;
end;
$$;

create function public.update_product(
  p_id uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_unit text,
  p_cost_price numeric,
  p_selling_price numeric,
  p_reorder_level integer,
  p_is_active boolean,
  p_supplier text default null,
  p_bonus_category text default null
)
returns public.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit products';
  end if;

  update public.products
    set sku = p_sku,
        name = p_name,
        category = p_category,
        unit = p_unit,
        cost_price = p_cost_price,
        selling_price = p_selling_price,
        reorder_level = p_reorder_level,
        is_active = p_is_active,
        supplier = p_supplier,
        bonus_category = p_bonus_category
    where id = p_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  return v_product;
end;
$$;

revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text, text) from public;
revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text, text) from anon;
grant execute on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text, text) to authenticated;

revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text, text) from public;
revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text, text) from anon;
grant execute on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text, text) to authenticated;
