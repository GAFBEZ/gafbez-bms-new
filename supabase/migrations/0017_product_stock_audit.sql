-- Closes an audit-trail gap: Inventory Master let quantity_in_stock be set
-- directly on create (initial stock) and edit (any correction), with no
-- corresponding stock_movements row -- unlike every other path that moves
-- stock (record_stock_movement, record_sale, record_return), which all log
-- to stock_movements atomically. From here on, both Add Product and Edit
-- Product go through the RPCs below instead of a plain insert/update, so
-- Inventory Master can no longer change quantity_in_stock invisibly.
--
-- Products aren't branch-scoped (quantity_in_stock is a single aggregate --
-- see 0003_products.sql), but stock_movements.branch_id is not-null, so
-- both RPCs take a branch to attribute the movement to -- same "for
-- reporting only" role branch_id already plays on every other movement.

-- Inserts the product, then -- if given a nonzero starting quantity --
-- logs it as an "Initial stock" stock_movements row in the same
-- transaction. A brand-new product can't yet be "low stock" by crossing a
-- threshold (there's no prior quantity to have been above it), so this
-- deliberately never fires a low-stock notification, unlike update_product
-- below.
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
  p_branch_id text
)
returns public.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  insert into public.products
    (sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, is_active)
  values
    (p_sku, p_name, p_category, p_unit, p_cost_price, p_selling_price, p_quantity_in_stock, p_reorder_level, p_is_active)
  returning * into v_product;

  if p_quantity_in_stock > 0 then
    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (v_product.id, p_branch_id, 'in', p_quantity_in_stock, 'Initial stock (new product)', auth.uid());
  end if;

  return v_product;
end;
$$;

revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text) from public;
revoke all on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text) from anon;
grant execute on function public.create_product(text, text, text, text, numeric, numeric, integer, integer, boolean, text) to authenticated;

-- Updates the product, then -- if the quantity field actually changed --
-- logs the delta as a stock_movements row ('in' if raised, 'out' if
-- lowered), reason "Manual correction (Inventory Master edit)". Reuses the
-- same low-stock crossing check as record_stock_movement()/record_sale()
-- (0016_low_stock_notifications.sql): fires only when the correction takes
-- quantity from above the (possibly also-just-edited) reorder_level to at
-- or below it, not on every edit of an already-low product.
create function public.update_product(
  p_id uuid,
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
  v_previous_quantity integer;
  v_product public.products;
  v_delta integer;
  v_branch_name text;
begin
  select quantity_in_stock into v_previous_quantity from public.products where id = p_id;
  if not found then
    raise exception 'Product not found';
  end if;

  update public.products
    set sku = p_sku,
        name = p_name,
        category = p_category,
        unit = p_unit,
        cost_price = p_cost_price,
        selling_price = p_selling_price,
        quantity_in_stock = p_quantity_in_stock,
        reorder_level = p_reorder_level,
        is_active = p_is_active
    where id = p_id
    returning * into v_product;

  v_delta := p_quantity_in_stock - v_previous_quantity;

  if v_delta <> 0 then
    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (
      p_id,
      p_branch_id,
      case when v_delta > 0 then 'in' else 'out' end,
      abs(v_delta),
      'Manual correction (Inventory Master edit)',
      auth.uid()
    );

    if v_delta < 0
      and v_previous_quantity > v_product.reorder_level
      and v_product.quantity_in_stock <= v_product.reorder_level
    then
      select name into v_branch_name from public.branches where id = p_branch_id;
      insert into public.notifications (type, message)
      values (
        'warning',
        v_product.name || ' is running low on stock at ' || coalesce(v_branch_name, p_branch_id)
          || ' (' || v_product.quantity_in_stock || ' left, reorder level ' || v_product.reorder_level || ').'
      );
    end if;
  end if;

  return v_product;
end;
$$;

revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, text) from public;
revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, text) from anon;
grant execute on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, text) to authenticated;
