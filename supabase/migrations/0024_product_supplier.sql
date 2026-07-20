-- Inventory Master: add a Supplier field to products, plus surface Profit
-- Margin and Reorder Level in the product list (both already existed as
-- data -- reorder_level has driven low-stock alerts since
-- 0016_low_stock_notifications.sql, and cost/selling price are already on
-- every row -- they just weren't shown as columns yet). Profit Margin is
-- computed client-side from existing costPrice/sellingPrice, so it needs
-- no new column or function change; only Supplier is new data.
--
-- No extra access-control changes needed here: Inventory Master is
-- already fully admin-only (0022_inventory_admin_only.sql gated the page
-- and the RPCs), so Supplier/Profit Margin inherit that same boundary
-- automatically.

alter table public.products add column if not exists supplier text;

-- create_product()/update_product() both gain a p_supplier param -- a
-- changed signature is a different function as far as Postgres is
-- concerned, so (same as update_product's rewrite in
-- 0018_per_branch_stock.sql) the old overloads must be dropped explicitly
-- and grants restated; CREATE OR REPLACE alone would leave the old
-- signature lingering unused and ungranted on the new one.
drop function if exists public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text);
drop function if exists public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean);

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
  p_supplier text default null
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
    (sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, is_active, supplier)
  values
    (p_sku, p_name, p_category, p_unit, p_cost_price, p_selling_price, 0, p_reorder_level, p_is_active, p_supplier)
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
  p_supplier text default null
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
        supplier = p_supplier
    where id = p_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  return v_product;
end;
$$;

revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text) from public;
revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text) from anon;
grant execute on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text, text) to authenticated;

revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text) from public;
revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text) from anon;
grant execute on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean, text) to authenticated;
