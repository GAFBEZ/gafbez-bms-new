-- sales.customer_name already exists (0055_sales_customer_name_override)
-- as a display-only override written only by mark_whatsapp_order_paid,
-- for a sale with no linked customers row. record_sale() itself never
-- wrote it -- a manually-recorded sale for someone not in the Customers
-- list just showed up as "Walk-in customer" with the name lost. This
-- lets record_sale() write it too, for the same reason: a free-text
-- label for a walk-in who isn't (and may never be) a tracked Customer,
-- mainly so the sale can be identified later and a receipt/invoice
-- generated right after the sale has someone to address.
comment on column public.sales.customer_name is 'Display-only override for a sale with no linked public.customers row: either a WhatsApp order''s customer name (see mark_whatsapp_order_paid) or a walk-in name typed directly into Record Sale (see record_sale). Null when an existing Customer was picked instead, which relies on the customer_id join.';

-- record_sale's signature is changing (new trailing param), so the old
-- 4-arg overload must be dropped explicitly first -- `create or replace`
-- alone would leave it behind as an orphaned duplicate rather than
-- replacing it, since Postgres treats a different argument list as a
-- different function (the same drift this project hit with
-- update_installer_quote_branding in 0066).
drop function if exists public.record_sale(uuid, text, jsonb, numeric);

create or replace function public.record_sale(
  p_customer_id uuid,
  p_branch_id text,
  p_items jsonb,
  p_amount_paid numeric,
  p_customer_name text default null
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

  insert into public.sales (customer_id, branch_id, customer_name, total_amount, amount_paid, status, created_by)
  values (
    p_customer_id,
    p_branch_id,
    nullif(trim(p_customer_name), ''),
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

revoke all on function public.record_sale(uuid, text, jsonb, numeric, text) from public;
revoke all on function public.record_sale(uuid, text, jsonb, numeric, text) from anon;
grant execute on function public.record_sale(uuid, text, jsonb, numeric, text) to authenticated;
