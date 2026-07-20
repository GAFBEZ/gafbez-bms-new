-- Stock Movement: an append-only ledger of stock received/issued per
-- branch. Movements are never edited or deleted (audit integrity) --
-- corrections are recorded as new movements. Each movement adjusts the
-- product's aggregate quantity_in_stock (still not split per branch --
-- see products table comment; branch_id here is for reporting only).

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id text not null references public.branches (id),
  type text not null check (type in ('in', 'out')),
  quantity integer not null check (quantity > 0),
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;

create policy "Authenticated users can read stock movements"
  on public.stock_movements
  for select
  to authenticated
  using (true);

-- Inserts only happen through record_stock_movement() below, but this
-- policy is still required for the SECURITY DEFINER function's insert to
-- pass RLS.
create policy "Authenticated users can insert stock movements"
  on public.stock_movements
  for insert
  to authenticated
  with check (true);

-- Atomically adjusts products.quantity_in_stock and records the movement
-- in one transaction, so a failed stock check never leaves an orphaned
-- movement row or a product update without a paper trail.
create function public.record_stock_movement(
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
      where id = p_product_id and quantity_in_stock >= p_quantity;

    if not found then
      raise exception 'Insufficient stock for this movement';
    end if;
  end if;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
  values (p_product_id, p_branch_id, p_type, p_quantity, p_reason, auth.uid())
  returning * into v_movement;

  return v_movement;
end;
$$;

-- Supabase grants EXECUTE on new functions directly to `anon` and
-- `authenticated` by default (not just to PUBLIC), so revoking from PUBLIC
-- alone is NOT enough to block unauthenticated calls -- anon must be
-- revoked explicitly too.
revoke all on function public.record_stock_movement(uuid, text, text, integer, text) from public;
revoke all on function public.record_stock_movement(uuid, text, text, integer, text) from anon;
grant execute on function public.record_stock_movement(uuid, text, text, integer, text) to authenticated;
