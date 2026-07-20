-- Automatic low-stock notifications. Previously notifications were
-- manual-only (see 0009_notifications.sql) because wiring an alert into
-- record_sale()/record_stock_movement() meant modifying already-tested,
-- high-traffic functions -- deliberately deferred until now.
--
-- Fires only on the *crossing* into low stock: quantity_in_stock was above
-- reorder_level before this deduction and is at-or-below it after. Not on
-- every subsequent sale/stock-out while a product is already low --
-- otherwise a popular low-stock item would post a new notification on
-- every single sale. Restocking (record_stock_movement()'s 'in' path, and
-- record_return()) only ever raises stock, so neither needs this check.
--
-- created_by is left null on these rows (unlike manually-posted
-- notifications, which set it to auth.uid() in the Server Action) so a
-- system-generated alert is distinguishable from a staff post if that
-- ever matters later.

-- Same as 0004_stock_movements.sql, with a low-stock crossing check added
-- after the 'out' deduction. Everything else (the type/quantity guards,
-- the insufficient-stock check, the movement insert) is unchanged.
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_branch_id text,
  p_type text,
  p_quantity integer,
  p_reason text
)
returns public.stock_movements
language plpgsql
security definer set search_path = ''
as $$
declare
  v_movement public.stock_movements;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_branch_name text;
begin
  if p_type not in ('in', 'out') then
    raise exception 'Invalid movement type: %', p_type;
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_type = 'in' then
    update public.products
      set quantity_in_stock = quantity_in_stock + p_quantity
      where id = p_product_id;
  else
    update public.products
      set quantity_in_stock = quantity_in_stock - p_quantity
      where id = p_product_id and quantity_in_stock >= p_quantity
      returning quantity_in_stock, reorder_level, name
      into v_new_quantity, v_reorder_level, v_product_name;

    if not found then
      raise exception 'Insufficient stock for this movement';
    end if;

    if v_new_quantity <= v_reorder_level and (v_new_quantity + p_quantity) > v_reorder_level then
      select name into v_branch_name from public.branches where id = p_branch_id;
      insert into public.notifications (type, message)
      values (
        'warning',
        v_product_name || ' is running low on stock at ' || coalesce(v_branch_name, p_branch_id)
          || ' (' || v_new_quantity || ' left, reorder level ' || v_reorder_level || ').'
      );
    end if;
  end if;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
  values (p_product_id, p_branch_id, p_type, p_quantity, p_reason, auth.uid())
  returning * into v_movement;

  return v_movement;
end;
$$;

-- Same as 0014_sale_profit_tracking.sql, with the same low-stock crossing
-- check added after each line item's deduction in pass 1. Everything else
-- (the insufficient-stock guard, the two-pass validate-then-write
-- structure, the unit_cost capture, the stock_movements/outstanding_balance
-- side effects) is unchanged.
create or replace function public.record_sale(
  p_customer_id uuid,
  p_branch_id text,
  p_items jsonb,
  p_amount_paid numeric
)
returns public.sales
language plpgsql
security definer set search_path = ''
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_total numeric := 0;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_branch_name text;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must have at least one item';
  end if;

  if p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

  select name into v_branch_name from public.branches where id = p_branch_id;

  -- Pass 1: validate + deduct stock for every item before writing anything,
  -- so a bad line item aborts the whole sale instead of a partial one.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    if v_quantity <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;
    if v_unit_price < 0 then
      raise exception 'Unit price cannot be negative';
    end if;

    update public.products
      set quantity_in_stock = quantity_in_stock - v_quantity
      where id = v_product_id and quantity_in_stock >= v_quantity
      returning quantity_in_stock, reorder_level, name
      into v_new_quantity, v_reorder_level, v_product_name;

    if not found then
      raise exception 'Insufficient stock for product %', v_product_id;
    end if;

    if v_new_quantity <= v_reorder_level and (v_new_quantity + v_quantity) > v_reorder_level then
      insert into public.notifications (type, message)
      values (
        'warning',
        v_product_name || ' is running low on stock at ' || coalesce(v_branch_name, p_branch_id)
          || ' (' || v_new_quantity || ' left, reorder level ' || v_reorder_level || ').'
      );
    end if;

    v_total := v_total + (v_quantity * v_unit_price);
  end loop;

  insert into public.sales (customer_id, branch_id, total_amount, amount_paid, status, created_by)
  values (
    p_customer_id,
    p_branch_id,
    v_total,
    p_amount_paid,
    case
      when p_amount_paid >= v_total then 'paid'
      when p_amount_paid > 0 then 'partial'
      else 'unpaid'
    end,
    auth.uid()
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
    values (
      v_sale.id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric,
      (select cost_price from public.products where id = (v_item ->> 'product_id')::uuid)
    );

    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (
      (v_item ->> 'product_id')::uuid,
      p_branch_id,
      'out',
      (v_item ->> 'quantity')::integer,
      'Sale ' || v_sale.id,
      auth.uid()
    );
  end loop;

  if p_customer_id is not null and p_amount_paid < v_total then
    update public.customers
      set outstanding_balance = outstanding_balance + (v_total - p_amount_paid)
      where id = p_customer_id;
  end if;

  return v_sale;
end;
$$;

-- CREATE OR REPLACE preserves each function's OID, and grants are tied to
-- the OID, so the anon-revoke/authenticated-grant from 0004/0006 still
-- applies without needing to be restated. Re-verified with an anon-key
-- script before shipping, same as every other privileged function change
-- in this app.
