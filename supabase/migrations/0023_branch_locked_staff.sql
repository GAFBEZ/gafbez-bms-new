-- Branch-locked staff: a non-admin with an assigned branch
-- (profiles.branch_id) can now only record a sale or a stock movement at
-- that branch -- not an arbitrary one they pick from a dropdown. Combined
-- with per-branch stock (0018_per_branch_stock.sql), this means staff can
-- only ever sell what's actually in stock at their own location, since
-- the insufficient-stock check already runs against the branch on the
-- request -- once that branch can't be anything but their own, "sell only
-- what's available at their location" falls out for free.
--
-- Admins are never restricted (need cross-branch access for oversight),
-- and a staff member with no assigned branch (branch_id is null) is also
-- left unrestricted, same as today -- forcing a hard block on an
-- unassigned account would leave them unable to do anything rather than
-- degrade gracefully.
--
-- Same technique as 0022: CREATE OR REPLACE with unchanged signatures, so
-- the existing anon-revoke/authenticated-grant carries over.

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
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_branch_name text;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must have at least one item';
  end if;

  if p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> p_branch_id
  then
    raise exception 'You can only record sales at your assigned branch';
  end if;

  select name into v_branch_name from public.branches where id = p_branch_id;

  -- Pass 1: validate + deduct branch stock for every item before writing
  -- anything, so a bad line item aborts the whole sale instead of a
  -- partial one.
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

    select reorder_level, name into v_reorder_level, v_product_name
      from public.products where id = v_product_id;

    if not found then
      raise exception 'Product not found: %', v_product_id;
    end if;

    select quantity into v_previous_quantity
      from public.product_stock where product_id = v_product_id and branch_id = p_branch_id;
    v_previous_quantity := coalesce(v_previous_quantity, 0);

    if v_previous_quantity < v_quantity then
      raise exception 'Insufficient stock for product % at this branch', v_product_id;
    end if;

    update public.product_stock
      set quantity = quantity - v_quantity
      where product_id = v_product_id and branch_id = p_branch_id
      returning quantity into v_new_quantity;

    if v_new_quantity <= v_reorder_level and v_previous_quantity > v_reorder_level then
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
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_branch_name text;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
begin
  if p_type not in ('in', 'out') then
    raise exception 'Invalid movement type: %', p_type;
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> p_branch_id
  then
    raise exception 'You can only record stock movements at your assigned branch';
  end if;

  select reorder_level, name into v_reorder_level, v_product_name
    from public.products where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select quantity into v_previous_quantity
    from public.product_stock where product_id = p_product_id and branch_id = p_branch_id;
  v_previous_quantity := coalesce(v_previous_quantity, 0);

  if p_type = 'in' then
    insert into public.product_stock (product_id, branch_id, quantity)
    values (p_product_id, p_branch_id, p_quantity)
    on conflict (product_id, branch_id) do update
      set quantity = public.product_stock.quantity + excluded.quantity;
  else
    if v_previous_quantity < p_quantity then
      raise exception 'Insufficient stock at this branch for this movement';
    end if;

    update public.product_stock
      set quantity = quantity - p_quantity
      where product_id = p_product_id and branch_id = p_branch_id
      returning quantity into v_new_quantity;

    if v_new_quantity <= v_reorder_level and v_previous_quantity > v_reorder_level then
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
