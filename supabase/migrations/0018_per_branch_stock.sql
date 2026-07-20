-- Real per-branch stock. Until now, products.quantity_in_stock was a
-- single company-wide aggregate even though every sale and stock movement
-- already recorded which branch it happened at (branch_id was "for
-- reporting only" -- see 0003_products.sql/0004_stock_movements.sql). This
-- adds a product_stock ledger (product_id, branch_id) -> quantity as the
-- real source of truth. products.quantity_in_stock becomes a
-- trigger-maintained cache (sum across branches) instead of something any
-- function sets directly, so every existing read path that wants the
-- company-wide total (dashboard cards, Inventory Master's "All Branches"
-- view, Sales Catalogue's "All Branches" view) keeps working unchanged.

create table public.product_stock (
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id text not null references public.branches (id),
  quantity integer not null default 0 check (quantity >= 0),
  primary key (product_id, branch_id)
);

alter table public.product_stock enable row level security;

create policy "Authenticated users can read product stock"
  on public.product_stock
  for select
  to authenticated
  using (true);

-- Only ever written through the SECURITY DEFINER functions below, but a
-- policy is still required for their inserts/updates to pass RLS -- same
-- pattern as stock_movements/sale_returns.
create policy "Authenticated users can write product stock"
  on public.product_stock
  for all
  to authenticated
  using (true)
  with check (true);

-- Keeps products.quantity_in_stock as a live cache of
-- sum(product_stock.quantity) for that product, so no function needs to
-- set it directly anymore -- every function below only ever touches
-- product_stock, and this trigger keeps the cache honest.
create function public.sync_product_quantity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  v_product_id := coalesce(new.product_id, old.product_id);

  update public.products
    set quantity_in_stock = (
      select coalesce(sum(quantity), 0) from public.product_stock where product_id = v_product_id
    )
    where id = v_product_id;

  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    update public.products
      set quantity_in_stock = (
        select coalesce(sum(quantity), 0) from public.product_stock where product_id = old.product_id
      )
      where id = old.product_id;
  end if;

  return null;
end;
$$;

create trigger sync_product_quantity_trigger
  after insert or update or delete on public.product_stock
  for each row execute procedure public.sync_product_quantity();

-- Backfill, part 1: replay stock_movements per (product, branch) -- that
-- table has recorded a branch on every movement since it launched, so
-- this is real history, not a guess. Floored at 0 per branch: the
-- insufficient-stock check historically ran against the aggregate, not
-- per branch, so a branch's replayed net can go negative if stock
-- physically "came from" pre-existing untracked stock rather than a
-- recorded 'in' at that branch -- there's no such thing as negative stock
-- in the ledger, so that shortfall is absorbed by the untracked
-- remainder in part 2 instead.
insert into public.product_stock (product_id, branch_id, quantity)
select
  product_id,
  branch_id,
  greatest(0, sum(case when type = 'in' then quantity else -quantity end))
from public.stock_movements
group by product_id, branch_id
on conflict (product_id, branch_id) do nothing;

-- Backfill, part 2: whatever's left of each product's current
-- quantity_in_stock beyond what the replay above accounted for is
-- untracked stock -- it existed before any movement was ever logged for
-- it (the 5 seed products from 0003_products.sql, and anything added via
-- the old unaudited insert/update before 0017_product_stock_audit.sql).
-- It has no recorded branch, so it's assigned entirely to Abuja; move it
-- to wherever it actually is via Stock Movement if that's wrong.
insert into public.product_stock (product_id, branch_id, quantity)
select
  p.id,
  'abuja',
  p.quantity_in_stock - coalesce(t.tracked_total, 0)
from public.products p
left join (
  select product_id, sum(quantity) as tracked_total
  from public.product_stock
  group by product_id
) t on t.product_id = p.id
where p.quantity_in_stock > coalesce(t.tracked_total, 0)
on conflict (product_id, branch_id) do update
  set quantity = public.product_stock.quantity + excluded.quantity;

-- Same as 0016_low_stock_notifications.sql, with the deduction and the
-- low-stock crossing check both moved from the products aggregate to this
-- product's stock at this specific branch. "Insufficient stock" now means
-- insufficient at *this branch*, even if other branches have plenty --
-- that's the whole point of this migration.
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
begin
  if p_type not in ('in', 'out') then
    raise exception 'Invalid movement type: %', p_type;
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
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

-- Same as 0016_low_stock_notifications.sql, with each line item's
-- deduction and low-stock crossing check moved from the products
-- aggregate to product_stock at the sale's own branch. Everything else
-- (the two-pass validate-then-write structure, unit_cost capture,
-- stock_movements logging, outstanding_balance top-up) is unchanged.
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
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must have at least one item';
  end if;

  if p_amount_paid < 0 then
    raise exception 'Amount paid cannot be negative';
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

-- Same as 0015_returns.sql, with the restock moved from the products
-- aggregate to product_stock at the *original sale's* branch (already
-- available as v_sale.branch_id -- the stock_movements row logged here
-- always used it too, it just wasn't affecting real per-branch stock
-- until now).
create or replace function public.record_return(
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

  insert into public.product_stock (product_id, branch_id, quantity)
  values (v_sale_item.product_id, v_sale.branch_id, p_quantity)
  on conflict (product_id, branch_id) do update
    set quantity = public.product_stock.quantity + excluded.quantity;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
  values (
    v_sale_item.product_id,
    v_sale.branch_id,
    'in',
    p_quantity,
    'Return: Sale ' || v_sale.id,
    auth.uid()
  );

  v_return_value := p_quantity * v_sale_item.unit_price;

  if v_sale.customer_id is not null then
    update public.customers
      set outstanding_balance = greatest(0, outstanding_balance - v_return_value)
      where id = v_sale.customer_id;
  end if;

  return v_return;
end;
$$;

-- Same as 0017_product_stock_audit.sql, with the initial quantity now
-- going into product_stock (so the trigger sets quantity_in_stock)
-- instead of being written to the products row directly.
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

-- Product edits go back to metadata-only: with stock now real per branch,
-- a single "quantity in stock" field on this form would be ambiguous
-- (which branch?). Corrections after creation go through Stock Movement,
-- which is already fully branch-aware and audited. This DROPs the
-- 0017 signature (which took p_quantity_in_stock/p_branch_id) and
-- replaces it with a metadata-only one -- a different parameter list is a
-- different function as far as Postgres is concerned, so the old
-- overload has to be dropped explicitly or it would linger unused.
drop function if exists public.update_product(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, text);

create function public.update_product(
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

-- update_product is a brand-new function object (different signature =
-- different OID, even with the same name), so its grants need to be
-- stated explicitly -- CREATE OR REPLACE only preserves grants when the
-- signature is unchanged. record_stock_movement/record_sale/record_return
-- /create_product above all kept their exact signatures, so their
-- existing anon-revoke/authenticated-grant carries over automatically;
-- re-verified with an anon-key script regardless, same as always.
revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean) from public;
revoke all on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean) from anon;
grant execute on function public.update_product(uuid, text, text, text, text, numeric, numeric, integer, boolean) to authenticated;
