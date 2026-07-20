-- Returns. Sales are append-only (see 0006_sales.sql), so a return is
-- never an edit to the original sale -- it's its own record, referencing
-- the specific sale_item and quantity being returned. Multiple partial
-- returns against the same line item are allowed (e.g. a customer returns
-- 1 of 3, then later returns another 1); record_return() enforces that the
-- running total can never exceed what was actually sold.

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id),
  quantity integer not null check (quantity > 0),
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.sale_returns enable row level security;

create policy "Authenticated users can read returns"
  on public.sale_returns
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert returns"
  on public.sale_returns
  for insert
  to authenticated
  with check (true);

-- Mirrors record_sale()'s shape: one SECURITY DEFINER function doing the
-- validate-then-write-atomically dance, because a return touches three
-- tables (sale_returns, products, stock_movements, and sometimes
-- customers) that the caller has no direct reason to write to all at once.
create function public.record_return(
  p_sale_item_id uuid,
  p_quantity integer,
  p_reason text
)
returns public.sale_returns
language plpgsql
security definer set search_path = ''
as $$
declare
  v_sale_item public.sale_items;
  v_sale public.sales;
  v_already_returned integer;
  v_return public.sale_returns;
  v_return_value numeric;
begin
  if p_quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;

  select * into v_sale_item from public.sale_items where id = p_sale_item_id;
  if not found then
    raise exception 'Sale item not found';
  end if;

  select * into v_sale from public.sales where id = v_sale_item.sale_id;

  select coalesce(sum(quantity), 0) into v_already_returned
    from public.sale_returns
    where sale_item_id = p_sale_item_id;

  if v_already_returned + p_quantity > v_sale_item.quantity then
    raise exception 'Cannot return more than was sold (already returned %, sold %)',
      v_already_returned, v_sale_item.quantity;
  end if;

  insert into public.sale_returns (sale_item_id, quantity, reason, created_by)
  values (p_sale_item_id, p_quantity, nullif(p_reason, ''), auth.uid())
  returning * into v_return;

  -- Put the stock back and log it, same audit-trail pattern as a sale's
  -- deduction -- Stock Movement stays the complete picture either way.
  update public.products
    set quantity_in_stock = quantity_in_stock + p_quantity
    where id = v_sale_item.product_id;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
  values (
    v_sale_item.product_id,
    v_sale.branch_id,
    'in',
    p_quantity,
    'Return: Sale ' || v_sale.id,
    auth.uid()
  );

  -- Credit the customer's running balance by the returned value, floored
  -- at zero -- outstanding_balance is one rolled-up number per customer
  -- (not per sale), so this is a straightforward credit, not a per-sale
  -- adjustment. If the sale was already fully paid, this doesn't create a
  -- negative balance; any cash refund owed happens outside the app, same
  -- as every other cash handling in this system.
  v_return_value := p_quantity * v_sale_item.unit_price;

  if v_sale.customer_id is not null then
    update public.customers
      set outstanding_balance = greatest(0, outstanding_balance - v_return_value)
      where id = v_sale.customer_id;
  end if;

  return v_return;
end;
$$;

-- Supabase grants EXECUTE on new functions directly to `anon`, not just
-- PUBLIC -- both must be revoked explicitly (see 0004 for how this bit us).
revoke all on function public.record_return(uuid, integer, text) from public;
revoke all on function public.record_return(uuid, integer, text) from anon;
grant execute on function public.record_return(uuid, integer, text) to authenticated;
