-- Inventory Master becomes admin-only: staff shouldn't see cost price or
-- margins at all. The page itself is now gated in the UI (an "Admins
-- only" screen, same pattern as Staff Management), but create_product()/
-- update_product() were still callable by any authenticated user at the
-- database level -- true before this, when Inventory Master was open to
-- every signed-in staff member, but now a real gap: a non-admin who knew
-- the RPC name could still create/edit products directly, bypassing the
-- UI block entirely. Deleting was already admin-only (0008_role_enforcement.sql);
-- create/update now match it.
--
-- Same technique as record_stock_movement()/record_sale() etc.: CREATE OR
-- REPLACE with an unchanged signature, so the existing
-- anon-revoke/authenticated-grant carries over without restating it.

create or replace function public.create_product(
  p_sku text,
  p_name text,
  p_category text,
  p_unit text,
  p_cost_price numeric,
  p_selling_price numeric,
  p_quantity_in_stock integer,
  p_reorder_level integer,
  p_is_active boolean,
  p_branch_id text
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
    (sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, is_active)
  values
    (p_sku, p_name, p_category, p_unit, p_cost_price, p_selling_price, 0, p_reorder_level, p_is_active)
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

create or replace function public.update_product(
  p_id uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_unit text,
  p_cost_price numeric,
  p_selling_price numeric,
  p_reorder_level integer,
  p_is_active boolean
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
        is_active = p_is_active
    where id = p_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  return v_product;
end;
$$;
