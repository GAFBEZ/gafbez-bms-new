-- Daily Sales: a sale header (sales) with one or more line items
-- (sale_items). Recording a sale atomically deducts stock per line item
-- (reusing the same insufficient-stock guard as record_stock_movement),
-- logs a matching stock_movements row per item for a unified audit trail,
-- and tops up the customer's outstanding_balance if the sale isn't paid
-- in full. Like stock_movements, sales are append-only -- no edit/delete,
-- corrections are handled as separate entries once returns/refunds exist.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id),
  branch_id text not null references public.branches (id),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  status text not null default 'unpaid' check (status in ('paid', 'partial', 'unpaid')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0)
);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "Authenticated users can read sales"
  on public.sales for select to authenticated using (true);

create policy "Authenticated users can insert sales"
  on public.sales for insert to authenticated with check (true);

create policy "Authenticated users can read sale items"
  on public.sale_items for select to authenticated using (true);

create policy "Authenticated users can insert sale items"
  on public.sale_items for insert to authenticated with check (true);

create function public.record_sale(
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
    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (
      v_sale.id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric
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

-- Supabase grants EXECUTE on new functions directly to `anon`, not just
-- PUBLIC -- both must be revoked explicitly (see 0004 for how this bit us).
revoke all on function public.record_sale(uuid, text, jsonb, numeric) from public;
revoke all on function public.record_sale(uuid, text, jsonb, numeric) from anon;
grant execute on function public.record_sale(uuid, text, jsonb, numeric) to authenticated;
