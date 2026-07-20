-- True profit tracking. Previously `sale_items` only recorded the selling
-- price per line item, not what the product cost at the time -- so the
-- dashboard's "Net Profit" card was really "revenue minus expenses",
-- silently ignoring cost of goods sold and overstating profit. This adds
-- `unit_cost`, captured automatically inside record_sale() from the
-- product's current cost_price at the moment of sale.

alter table public.sale_items
  add column unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0);

-- Backfill existing sales with each product's *current* cost_price as an
-- approximation -- the actual historical cost at the time of each past
-- sale isn't recoverable, and this beats leaving it at 0 (which would
-- overstate profit on every pre-existing sale far worse than a same-price
-- approximation does). Going forward, every new sale captures the real
-- cost at time of sale via record_sale() below.
update public.sale_items si
set unit_cost = p.cost_price
from public.products p
where p.id = si.product_id and si.unit_cost = 0;

-- Same function as 0006_sales.sql, with one addition: sale_items.unit_cost
-- is now captured from the product's cost_price at insert time. Everything
-- else (the insufficient-stock guard, the two-pass validate-then-write
-- structure, the stock_movements logging, the outstanding_balance top-up)
-- is unchanged.
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
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must have at least one item';
  end if;

  if p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative';
  end if;

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
      where id = v_product_id and quantity_in_stock >= v_quantity;

    if not found then
      raise exception 'Insufficient stock for product %', v_product_id;
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

-- CREATE OR REPLACE preserves the function's OID, and grants are tied to
-- the OID, so the anon-revoke/authenticated-grant from 0006 still applies
-- without needing to be restated. Verified with an anon-key script before
-- shipping, same as every other privileged function in this app.
