-- A "Stock Out" at one branch plus a separate "Stock In" at another was
-- the only way to move inventory between branches -- two disconnected
-- entries that can drift out of sync (forgotten second step, mismatched
-- quantity), and a lone "Out" row reads ambiguously in the ledger. This
-- adds one atomic transfer action instead. Confirmed first: a "Stock
-- Out" has zero accounting/financial side effects today (revenue/profit
-- comes only from sales/sale_items, never this table), so the real
-- problem was atomicity and ledger clarity, not the books.
alter table public.stock_movements
  add column transfer_id uuid;

comment on column public.stock_movements.transfer_id is 'Set only on the pair of rows created by record_stock_transfer() -- both the "out" (source) and "in" (destination) row share the same value, letting a transfer be found/grouped later. Null for an ordinary Stock In/Out entry.';

-- Modeled directly on record_stock_movement() (0023_branch_locked_staff.sql):
-- same product/stock lookups, same insufficient-stock check, same
-- low-stock notification logic -- just applied across two branches in one
-- transaction instead of one. Reuses the existing 'in'/'out' type values
-- (not a new 'transfer' type) so the Stock Movement history table's type
-- badges/filter need no changes at all -- a transfer just shows up as an
-- ordinary Out at the source branch and In at the destination, with a
-- reason that says exactly what happened.
create or replace function public.record_stock_transfer(
  p_product_id uuid,
  p_from_branch_id text,
  p_to_branch_id text,
  p_quantity integer,
  p_note text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_is_manager boolean;
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_from_branch_name text;
  v_to_branch_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_transfer_id uuid := gen_random_uuid();
begin
  if p_from_branch_id = p_to_branch_id then
    raise exception 'Choose two different branches to transfer between';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  -- Stricter than record_stock_movement's single-branch lock: a transfer
  -- touches two branches' books at once, so this is Owner/Manager only,
  -- not "any staff at their own branch". Load-bearing check -- the page
  -- level gate is UX only, matching this codebase's existing
  -- "database-enforced, not UI convention" pattern.
  select (role = 'admin'), coalesce(is_branch_manager, false)
    into v_is_admin, v_is_manager
    from public.profiles where id = auth.uid();

  if not (coalesce(v_is_admin, false) or coalesce(v_is_manager, false)) then
    raise exception 'Only an Owner or branch Manager can transfer stock between branches';
  end if;

  select reorder_level, name into v_reorder_level, v_product_name
    from public.products where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select name into v_from_branch_name from public.branches where id = p_from_branch_id;
  select name into v_to_branch_name from public.branches where id = p_to_branch_id;

  if v_from_branch_name is null or v_to_branch_name is null then
    raise exception 'Branch not found';
  end if;

  select quantity into v_previous_quantity
    from public.product_stock where product_id = p_product_id and branch_id = p_from_branch_id;
  v_previous_quantity := coalesce(v_previous_quantity, 0);

  if v_previous_quantity < p_quantity then
    raise exception 'Insufficient stock at %, only % available', v_from_branch_name, v_previous_quantity;
  end if;

  update public.product_stock
    set quantity = quantity - p_quantity
    where product_id = p_product_id and branch_id = p_from_branch_id
    returning quantity into v_new_quantity;

  insert into public.product_stock (product_id, branch_id, quantity)
  values (p_product_id, p_to_branch_id, p_quantity)
  on conflict (product_id, branch_id) do update
    set quantity = public.product_stock.quantity + excluded.quantity;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by, transfer_id)
  values
    (
      p_product_id, p_from_branch_id, 'out', p_quantity,
      'Transfer to ' || v_to_branch_name || case when v_note is not null then ': ' || v_note else '' end,
      auth.uid(), v_transfer_id
    ),
    (
      p_product_id, p_to_branch_id, 'in', p_quantity,
      'Transfer from ' || v_from_branch_name || case when v_note is not null then ': ' || v_note else '' end,
      auth.uid(), v_transfer_id
    );

  if v_new_quantity <= v_reorder_level and v_previous_quantity > v_reorder_level then
    insert into public.notifications (type, message)
    values (
      'warning',
      v_product_name || ' is running low on stock at ' || v_from_branch_name
        || ' (' || v_new_quantity || ' left, reorder level ' || v_reorder_level || ') after a transfer to ' || v_to_branch_name || '.'
    );
  end if;
end;
$$;

revoke all on function public.record_stock_transfer(uuid, text, text, integer, text) from public;
revoke all on function public.record_stock_transfer(uuid, text, text, integer, text) from anon;
grant execute on function public.record_stock_transfer(uuid, text, text, integer, text) to authenticated;
