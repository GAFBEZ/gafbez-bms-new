-- Customer orders, branch stock reservations, and Paystack payment
-- processing (Stage 5 of the public-site rebuild). Shared-Supabase-project
-- change, same as 0028/0029 -- the website consumes this with the anon/
-- authenticated key (customer session), the Paystack webhook/verification
-- routes use the service_role key (see STAGE_5_ORDERS_PAYMENTS_NOTES.md in
-- the website project for why that's the one genuinely-needed use of
-- service_role in this whole system).

-- ---------------------------------------------------------------------
-- 0. Fixes a regression introduced in 0029_customer_accounts_and_cart.sql
-- ---------------------------------------------------------------------
-- 0029's `create or replace function handle_new_user()` was written
-- against the ORIGINAL 0002_profiles.sql body and didn't notice that
-- 0011_staff_management.sql had already upgraded it to also populate
-- `email` on the new profiles row. The result: since 0029 was applied,
-- every *new* staff account (created via the Supabase Dashboard) would
-- get a profiles row with email left null, silently regressing the "keep
-- email in sync for staff created from here on" behavior 0011 added.
-- Restores that behaviour while keeping 0029's customer-signup guard.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    return new;
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Central config: reservation expiry window
-- ---------------------------------------------------------------------
-- Reuses the existing app_settings singleton (0012_app_settings.sql)
-- rather than inventing a new config table.

alter table public.app_settings
  add column reservation_expiry_minutes integer not null default 30
    check (reservation_expiry_minutes > 0);

comment on column public.app_settings.reservation_expiry_minutes is 'How long an active stock reservation (and the order awaiting payment behind it) survives before release_expired_reservations() releases it. Default 30 minutes per the task brief.';

-- ---------------------------------------------------------------------
-- 2. orders
-- ---------------------------------------------------------------------
-- branch_id is `text` (matches public.branches.id, e.g. 'abuja'), not
-- `uuid` as the task brief suggested -- same deviation Stage 2/3 already
-- made for the same reason (see 0028_website_catalogue.sql). customer_id
-- references customer_profiles (the Stage 4 website-login table), not
-- auth.users directly, so a join for name/email/phone never needs to
-- reach auth.users from RLS-restricted contexts.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customer_profiles (id),
  branch_id text not null references public.branches (id),
  order_type text not null check (order_type in ('online_payment', 'whatsapp_request')),
  status text not null check (status in (
    'pending_payment', 'payment_processing', 'paid', 'ready_for_pickup', 'completed',
    'cancelled', 'payment_failed', 'expired', 'whatsapp_review_required', 'whatsapp_confirmed'
  )),
  payment_status text not null default 'unpaid' check (payment_status in (
    'unpaid', 'pending', 'successful', 'failed', 'abandoned', 'refunded'
  )),
  payment_method text check (payment_method in ('paystack', 'whatsapp')),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  store_credit_used numeric(14, 2) not null default 0 check (store_credit_used >= 0),
  amount_payable numeric(14, 2) not null check (amount_payable >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'NGN',
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  pickup_notes text,
  paystack_reference text unique,
  payment_authorization_url text,
  payment_access_code text,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_customer_idempotency_key_unique unique (customer_id, client_idempotency_key)
);

comment on column public.orders.client_idempotency_key is 'A key the website generates once per checkout attempt (before calling create_online_order_with_reservation) and reuses on retry -- lets that function return the existing order instead of creating a duplicate if the same checkout submission reaches the server twice (double-click, network retry). Null for orders created before this existed; the unique constraint only applies to non-null values within one customer, so nulls (and the same key reused by two different customers) are both fine.';

comment on table public.orders is 'One row per checkout attempt (online_payment or whatsapp_request). A failed/expired online_payment order is terminal -- a retry creates a brand-new order + reference rather than reusing the failed one, so "do not reuse a failed Paystack reference" holds trivially.';
comment on column public.orders.store_credit_used is 'Schema placeholder for a future stage -- store credit itself is out of scope for Stage 5 and always 0 here.';

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_branch_id_idx on public.orders (branch_id);
create index orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

create policy "Customers can read their own orders"
  on public.orders
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all orders"
  on public.orders
  for select
  to authenticated
  using (public.is_admin());

-- "Manager of the selected branch" in this schema means a non-admin staff
-- member whose profiles.branch_id matches the order's branch -- there is
-- no separate Manager role (see 0023_branch_locked_staff.sql).
create policy "Branch staff can read their branch's orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and branch_id = orders.branch_id
    )
  );

-- No insert/update/delete grant to authenticated or anon at all -- every
-- write goes through a SECURITY DEFINER function below (order creation,
-- cancellation, payment finalisation, expiry), each enforcing its own
-- ownership/state checks. This is what makes "customers must not set
-- order totals/payment status/mark orders paid" a database fact rather
-- than a UI convention -- same pattern as customer_profiles in Stage 4.
grant select on public.orders to authenticated;

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. order_items
-- ---------------------------------------------------------------------
-- A full historical snapshot of the product at order time (name/sku/slug/
-- image/price) -- so a later product edit or even deletion never changes
-- what a past order shows. Never a cost_price column here, by design.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  product_sku text,
  product_slug text,
  product_image_url text,
  website_price numeric(14, 2) not null check (website_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

create policy "Customers can read their own order items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.customer_id = auth.uid()
    )
  );

create policy "Admins can read all order items"
  on public.order_items
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's order items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.profiles p on p.branch_id = o.branch_id
      where o.id = order_items.order_id and p.id = auth.uid()
    )
  );

grant select on public.order_items to authenticated;

-- ---------------------------------------------------------------------
-- 4. stock_reservations
-- ---------------------------------------------------------------------
-- Reservations reduce *available-to-sell* stock (see get_available_to_sell
-- below) without ever touching product_stock -- physical stock is only
-- ever deducted once, at payment finalisation. order_item_id (an addition
-- beyond the task brief's suggested column list) is what the partial
-- unique index below uses to enforce "no duplicate active reservation for
-- the same order item".

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete cascade,
  product_id uuid not null references public.products (id),
  branch_id text not null references public.branches (id),
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'released', 'fulfilled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  fulfilled_at timestamptz
);

comment on table public.stock_reservations is 'Append-only audit trail: a reservation''s status changes (active -> released/fulfilled/expired) but rows are never deleted, so "what happened to the stock behind order X" is always answerable.';

create unique index stock_reservations_active_order_item_key
  on public.stock_reservations (order_item_id)
  where status = 'active';

create index stock_reservations_order_id_idx on public.stock_reservations (order_id);
create index stock_reservations_product_branch_active_idx
  on public.stock_reservations (product_id, branch_id)
  where status = 'active';
create index stock_reservations_expires_at_idx
  on public.stock_reservations (expires_at)
  where status = 'active';

alter table public.stock_reservations enable row level security;

-- No customer read policy: the task brief's customer-allowed list is
-- orders + order items only. A customer's reservation countdown on the
-- confirmation page reads orders.reservation_expires_at instead, which is
-- already on the row they're allowed to read.
create policy "Admins can read all reservations"
  on public.stock_reservations
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's reservations"
  on public.stock_reservations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and branch_id = stock_reservations.branch_id
    )
  );

grant select on public.stock_reservations to authenticated;

-- ---------------------------------------------------------------------
-- 5. payment_events (webhook/verification audit log)
-- ---------------------------------------------------------------------
-- Staff/admin-only, and even then only via an explicit admin check --
-- customers must never read raw webhook payloads. `safe_payload` is
-- whatever the calling route chooses to store; the routes below never
-- pass card numbers/authorization codes into it (Paystack's charge.success
-- payload already omits full card numbers, but authorization details are
-- deliberately stripped before storage regardless -- see
-- STAGE_5_ORDERS_PAYMENTS_NOTES.md).

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text,
  event_type text not null,
  event_key text not null unique,
  order_id uuid references public.orders (id),
  signature_valid boolean not null,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'error')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  safe_payload jsonb not null default '{}'::jsonb,
  error_message text
);

comment on column public.payment_events.event_key is 'Idempotency key: `<event_type>:<paystack transaction id>` for webhook deliveries, so Paystack retrying the same webhook is a harmless no-op (unique_violation on the second insert attempt).';

create index payment_events_order_id_idx on public.payment_events (order_id);

alter table public.payment_events enable row level security;

create policy "Admins can read payment events"
  on public.payment_events
  for select
  to authenticated
  using (public.is_admin());

grant select on public.payment_events to authenticated;
-- Deliberately no insert/update grant to authenticated/anon -- only the
-- service_role-authenticated webhook/verification routes ever write here.
grant select, insert, update on public.payment_events to service_role;

-- ---------------------------------------------------------------------
-- 6. Available-to-sell stock
-- ---------------------------------------------------------------------

create function public.get_available_to_sell(p_product_id uuid, p_branch_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    coalesce((select quantity from public.product_stock where product_id = p_product_id and branch_id = p_branch_id), 0)
    - coalesce((
        select sum(quantity) from public.stock_reservations
        where product_id = p_product_id and branch_id = p_branch_id
          and status = 'active' and expires_at > now()
      ), 0)
  );
$$;

revoke all on function public.get_available_to_sell(uuid, text) from public;
grant execute on function public.get_available_to_sell(uuid, text) to anon, authenticated;

-- Updates the Stage 2 branch catalogue RPC (same signature, so the
-- anon/authenticated grant from 0028_website_catalogue.sql carries over
-- unchanged) so branch_quantity/branch_stock_status reflect
-- available-to-sell rather than raw physical stock -- an item with 3
-- physical units but 3 already reserved by other customers' pending
-- checkouts now correctly shows out_of_stock. branch_quantity is left in
-- the return shape for backward compatibility with the Stage 3/4 website
-- code that already expects this column, but no Stage 3-5 UI ever renders
-- the raw number (only the in/out-of-stock badge) -- see
-- STAGE_5_ORDERS_PAYMENTS_NOTES.md for the full reasoning.
create or replace function public.get_website_catalogue_by_branch(p_branch_id text)
returns table (
  id uuid,
  sku text,
  name text,
  brand text,
  model text,
  category text,
  unit text,
  short_description text,
  full_description text,
  website_price numeric,
  website_slug text,
  product_image_url text,
  gallery_image_urls jsonb,
  specifications jsonb,
  warranty_text text,
  is_featured_on_website boolean,
  website_display_order integer,
  is_combo_eligible boolean,
  calculator_eligible boolean,
  branch_id text,
  branch_name text,
  branch_quantity integer,
  branch_stock_status text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_branch_name text;
  v_branch_status text;
begin
  select b.name, b.status into v_branch_name, v_branch_status
    from public.branches b
    where b.id = p_branch_id;

  if not found then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;

  if v_branch_status <> 'active' then
    raise exception 'Branch is not active: %', p_branch_id;
  end if;

  return query
    select
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.model,
      p.category,
      p.unit,
      p.short_description,
      p.full_description,
      p.website_price,
      p.website_slug,
      p.product_image_url,
      p.gallery_image_urls,
      p.specifications,
      p.warranty_text,
      p.is_featured_on_website,
      p.website_display_order,
      p.is_combo_eligible,
      p.calculator_eligible,
      p_branch_id,
      v_branch_name,
      public.get_available_to_sell(p.id, p_branch_id),
      case when public.get_available_to_sell(p.id, p_branch_id) > 0 then 'in_stock' else 'out_of_stock' end
    from public.products p
    where p.is_active = true and p.is_visible_on_website = true
    order by p.website_display_order, p.name;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Atomic online (Paystack) order + reservation creation
-- ---------------------------------------------------------------------
-- p_items shape: [{"product_id": "...", "quantity": 2}, ...]. Every value
-- used to price the order (product name/price, branch availability) is
-- re-read here from the trusted tables -- nothing from the client is
-- trusted except which product ids and quantities were requested.

create function public.create_online_order_with_reservation(
  p_branch_id text,
  p_items jsonb,
  p_idempotency_key text default null
)
returns table (
  order_id uuid,
  order_number text,
  paystack_reference text,
  amount_payable numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_customer public.customer_profiles;
  v_branch_status text;
  v_expiry_minutes integer;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products;
  v_physical_stock integer;
  v_reserved integer;
  v_available integer;
  v_subtotal numeric := 0;
  v_order public.orders;
  v_order_number text;
  v_reference text;
  v_order_item_id uuid;
  v_expires_at timestamptz;
begin
  if v_customer_id is null then
    raise exception 'You must be logged in to check out';
  end if;

  -- Idempotency short-circuit: if this exact checkout attempt already
  -- created an order (the first response was lost, a double-click fired
  -- two requests, etc.), return that same order instead of creating a
  -- second one. Deliberately checked before any other validation --
  -- a retry should never fail differently than the original just because
  -- stock or a product changed in the few seconds between the two calls.
  if p_idempotency_key is not null then
    select * into v_order
      from public.orders
      where customer_id = v_customer_id and client_idempotency_key = p_idempotency_key;

    if found then
      return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable;
      return;
    end if;
  end if;

  if not exists (
    select 1 from auth.users where id = v_customer_id and email_confirmed_at is not null
  ) then
    raise exception 'Please verify your email address before checking out';
  end if;

  select * into v_customer from public.customer_profiles where id = v_customer_id;
  if not found or not v_customer.is_active then
    raise exception 'Your customer profile could not be found';
  end if;

  if v_customer.phone_normalized is null or nullif(btrim(v_customer.full_name), '') is null then
    raise exception 'Please complete your profile (name and phone) before checking out';
  end if;

  select status into v_branch_status from public.branches where id = p_branch_id;
  if not found or v_branch_status <> 'active' then
    raise exception 'Selected branch is not available';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  select reservation_expiry_minutes into v_expiry_minutes from public.app_settings;
  v_expiry_minutes := coalesce(v_expiry_minutes, 30);
  v_expires_at := now() + make_interval(mins => v_expiry_minutes);

  -- Pass 1: validate every item and compute the trusted subtotal. Items
  -- are locked in a fixed (product_id) order across ALL callers, which is
  -- what prevents a classic "two transactions locking two shared rows in
  -- opposite order" deadlock when two different orders both include the
  -- same two products.
  for v_item in
    select value from jsonb_array_elements(p_items) as t(value) order by (value ->> 'product_id')
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null then
      raise exception 'Invalid product in cart';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Invalid quantity in cart';
    end if;

    select * into v_product from public.products where id = v_product_id;
    if not found or not v_product.is_active or not v_product.is_visible_on_website then
      raise exception 'A product in your cart is no longer available';
    end if;

    if v_product.website_price is null then
      raise exception '% does not have a price set and cannot be purchased online', v_product.name;
    end if;

    -- Locks this product's branch stock row for the rest of the
    -- transaction -- a concurrent checkout for the same product/branch
    -- blocks here until this transaction commits or rolls back, which is
    -- what makes the availability check below race-free.
    select quantity into v_physical_stock
      from public.product_stock
      where product_id = v_product_id and branch_id = p_branch_id
      for update;
    v_physical_stock := coalesce(v_physical_stock, 0);

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_product_id and branch_id = p_branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_quantity then
      raise exception '% is no longer available in the requested quantity at this branch', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.website_price * v_quantity);
  end loop;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_reference := v_order_number;

  -- Pass 2: the transaction still holds every product_stock lock acquired
  -- above, so nothing about availability can have changed since pass 1 --
  -- create the order, its items, and their reservations together. Any
  -- error past this point (including the loop below) rolls back
  -- everything created so far in this call, satisfying "if any product
  -- cannot be reserved, create nothing."
  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, amount_payable, customer_name, customer_email, customer_phone,
    paystack_reference, reservation_expires_at, client_idempotency_key
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'online_payment', 'pending_payment', 'unpaid', 'paystack',
    v_subtotal, v_subtotal, v_customer.full_name, v_customer.email, v_customer.phone,
    v_reference, v_expires_at, p_idempotency_key
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products where id = v_product_id;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, v_product.website_price, v_quantity,
      v_product.website_price * v_quantity
    )
    returning id into v_order_item_id;

    insert into public.stock_reservations (
      order_id, order_item_id, product_id, branch_id, quantity, status, expires_at
    ) values (
      v_order.id, v_order_item_id, v_product.id, p_branch_id, v_quantity, 'active', v_expires_at
    );
  end loop;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable;
end;
$$;

revoke all on function public.create_online_order_with_reservation(text, jsonb, text) from public;
revoke all on function public.create_online_order_with_reservation(text, jsonb, text) from anon;
grant execute on function public.create_online_order_with_reservation(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Store the Paystack payment link once initialisation succeeds
-- ---------------------------------------------------------------------
-- Split from order creation because the order must exist (with its
-- reference) before we can call Paystack's initialize endpoint, but the
-- authorization_url/access_code only exist after that call returns.
-- auth.uid()-checked ownership -- a customer can only attach a payment
-- link to their own order.

create function public.set_order_payment_link(
  p_order_id uuid,
  p_authorization_url text,
  p_access_code text
)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders
    set payment_authorization_url = p_authorization_url,
        payment_access_code = p_access_code,
        status = 'payment_processing'
    where id = p_order_id and customer_id = auth.uid() and status = 'pending_payment'
    returning * into v_order;

  if not found then
    raise exception 'Order not found or no longer awaiting payment';
  end if;

  return v_order;
end;
$$;

revoke all on function public.set_order_payment_link(uuid, text, text) from public;
revoke all on function public.set_order_payment_link(uuid, text, text) from anon;
grant execute on function public.set_order_payment_link(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. WhatsApp order requests (no reservation)
-- ---------------------------------------------------------------------

create function public.create_whatsapp_order(
  p_branch_id text,
  p_items jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_customer public.customer_profiles;
  v_branch_status text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products;
  v_available integer;
  v_subtotal numeric := 0;
  v_order public.orders;
  v_order_number text;
begin
  if v_customer_id is null then
    raise exception 'You must be logged in to check out';
  end if;

  if not exists (
    select 1 from auth.users where id = v_customer_id and email_confirmed_at is not null
  ) then
    raise exception 'Please verify your email address before checking out';
  end if;

  select * into v_customer from public.customer_profiles where id = v_customer_id;
  if not found or not v_customer.is_active then
    raise exception 'Your customer profile could not be found';
  end if;

  if v_customer.phone_normalized is null or nullif(btrim(v_customer.full_name), '') is null then
    raise exception 'Please complete your profile (name and phone) before checking out';
  end if;

  select status into v_branch_status from public.branches where id = p_branch_id;
  if not found or v_branch_status <> 'active' then
    raise exception 'Selected branch is not available';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  -- Read-only availability check (no locking, no reservation) -- a
  -- WhatsApp request is a request to buy, not a hold on stock. Staff
  -- confirm availability again at confirmation time (see
  -- confirm_whatsapp_order below), which is the point stock actually gets
  -- reserved for this flow.
  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Invalid item in cart';
    end if;

    select * into v_product from public.products where id = v_product_id;
    if not found or not v_product.is_active or not v_product.is_visible_on_website then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.website_price is null then
      raise exception '% does not have a price set', v_product.name;
    end if;

    v_available := public.get_available_to_sell(v_product_id, p_branch_id);
    if v_available < v_quantity then
      raise exception '% is currently out of stock at this branch', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.website_price * v_quantity);
  end loop;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, amount_payable, customer_name, customer_email, customer_phone
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'whatsapp_request', 'whatsapp_review_required', 'unpaid', 'whatsapp',
    v_subtotal, v_subtotal, v_customer.full_name, v_customer.email, v_customer.phone
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products where id = v_product_id;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, v_product.website_price, v_quantity,
      v_product.website_price * v_quantity
    );
  end loop;

  insert into public.notifications (type, message)
  values (
    'info',
    'New WhatsApp order request ' || v_order.order_number || ' at ' ||
      coalesce((select name from public.branches where id = p_branch_id), p_branch_id) || '.'
  );

  return query select v_order.id, v_order.order_number;
end;
$$;

revoke all on function public.create_whatsapp_order(text, jsonb) from public;
revoke all on function public.create_whatsapp_order(text, jsonb) from anon;
grant execute on function public.create_whatsapp_order(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Staff confirmation foundation for WhatsApp requests
-- ---------------------------------------------------------------------
-- No BMS UI is built in this stage (see task restriction "do not build a
-- large BMS redesign") -- these two functions are the database-side
-- foundation a future BMS "WhatsApp Requests" screen would call. Same
-- branch-lock pattern as record_sale()/record_stock_movement()
-- (0023_branch_locked_staff.sql): admins can confirm/reject any request,
-- non-admin staff only ones at their own assigned branch.

create function public.confirm_whatsapp_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
  v_item record;
  v_available integer;
  v_expiry_minutes integer;
  v_expires_at timestamptz;
begin
  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if v_caller_is_admin is null then
    raise exception 'Only staff can confirm WhatsApp requests';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_order.branch_id
  then
    raise exception 'You can only confirm requests at your assigned branch';
  end if;

  if v_order.status <> 'whatsapp_review_required' then
    raise exception 'This request is not awaiting confirmation';
  end if;

  select reservation_expiry_minutes into v_expiry_minutes from public.app_settings;
  v_expires_at := now() + make_interval(mins => coalesce(v_expiry_minutes, 30));

  -- Re-validate and reserve, item by item, locking each product's branch
  -- stock row exactly like create_online_order_with_reservation does.
  for v_item in
    select oi.id as order_item_id, oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id
    order by oi.product_id
  loop
    perform quantity from public.product_stock
      where product_id = v_item.product_id and branch_id = v_order.branch_id
      for update;

    v_available := public.get_available_to_sell(v_item.product_id, v_order.branch_id);
    if v_available < v_item.quantity then
      raise exception 'Insufficient stock to confirm this request';
    end if;

    insert into public.stock_reservations (order_id, order_item_id, product_id, branch_id, quantity, status, expires_at)
    values (v_order.id, v_item.order_item_id, v_item.product_id, v_order.branch_id, v_item.quantity, 'active', v_expires_at);
  end loop;

  update public.orders
    set status = 'whatsapp_confirmed', reservation_expires_at = v_expires_at
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('success', 'WhatsApp request ' || v_order.order_number || ' confirmed and stock reserved.');

  return v_order;
end;
$$;

revoke all on function public.confirm_whatsapp_order(uuid) from public;
revoke all on function public.confirm_whatsapp_order(uuid) from anon;
grant execute on function public.confirm_whatsapp_order(uuid) to authenticated;

create function public.reject_whatsapp_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
begin
  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if v_caller_is_admin is null then
    raise exception 'Only staff can reject WhatsApp requests';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_order.branch_id
  then
    raise exception 'You can only reject requests at your assigned branch';
  end if;

  if v_order.status <> 'whatsapp_review_required' then
    raise exception 'This request is not awaiting confirmation';
  end if;

  -- No enum value exists for "rejected"; cancelled + a reason is the
  -- existing status this schema already has for "this order will not be
  -- fulfilled" (same status a customer's own cancellation uses).
  update public.orders
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Unavailable at this branch')
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('warning', 'WhatsApp request ' || v_order.order_number || ' could not be fulfilled and was rejected.');

  return v_order;
end;
$$;

revoke all on function public.reject_whatsapp_order(uuid, text) from public;
revoke all on function public.reject_whatsapp_order(uuid, text) from anon;
grant execute on function public.reject_whatsapp_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Customer cancellation of unpaid orders
-- ---------------------------------------------------------------------

create function public.cancel_own_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
    where id = p_order_id and customer_id = auth.uid()
    for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'successful' then
    raise exception 'Paid orders cannot be cancelled here -- please contact us';
  end if;

  if v_order.status not in ('pending_payment', 'payment_processing', 'payment_failed', 'whatsapp_review_required') then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.stock_reservations
    set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';

  update public.orders
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = nullif(btrim(p_reason), '')
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values (
    'info',
    'Customer cancelled order ' || v_order.order_number || ' at ' ||
      coalesce((select name from public.branches where id = v_order.branch_id), v_order.branch_id) || '.'
  );

  return v_order;
end;
$$;

revoke all on function public.cancel_own_order(uuid, text) from public;
revoke all on function public.cancel_own_order(uuid, text) from anon;
grant execute on function public.cancel_own_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Reservation expiry sweep
-- ---------------------------------------------------------------------
-- service_role only -- called by a scheduled job, never by a user
-- session. See STAGE_5_ORDERS_PAYMENTS_NOTES.md for the three supported
-- ways to schedule it (this project has no existing cron/scheduled-
-- function convention to reuse).

create function public.release_expired_reservations()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_released_count integer := 0;
  v_order record;
begin
  update public.stock_reservations
    set status = 'expired', released_at = now()
    where status = 'active' and expires_at <= now();
  get diagnostics v_released_count = row_count;

  for v_order in
    select * from public.orders
    where status in ('pending_payment', 'payment_processing', 'whatsapp_confirmed')
      and reservation_expires_at is not null
      and reservation_expires_at <= now()
  loop
    update public.orders set status = 'expired' where id = v_order.id;

    insert into public.notifications (type, message)
    values ('warning', 'Order ' || v_order.order_number || ' expired unpaid and its reserved stock was released.');
  end loop;

  return v_released_count;
end;
$$;

revoke all on function public.release_expired_reservations() from public;
revoke all on function public.release_expired_reservations() from anon;
revoke all on function public.release_expired_reservations() from authenticated;
grant execute on function public.release_expired_reservations() to service_role;

-- ---------------------------------------------------------------------
-- 13. Payment failure handling
-- ---------------------------------------------------------------------
-- service_role only -- called from the webhook/verification routes after
-- Paystack itself reports a non-success outcome, never from a customer
-- session (a customer marking their own payment "failed" would let them
-- release a reservation Paystack hasn't actually confirmed failed yet).

create function public.mark_order_payment_failed(p_paystack_reference text, p_payment_status text)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if p_payment_status not in ('failed', 'abandoned') then
    raise exception 'Invalid payment status: %', p_payment_status;
  end if;

  select * into v_order from public.orders where paystack_reference = p_paystack_reference for update;
  if not found then
    raise exception 'Order not found for reference %', p_paystack_reference;
  end if;

  -- Idempotent: never downgrade a payment that already succeeded, and
  -- don't re-process an order that's already marked failed.
  if v_order.payment_status in ('successful', 'failed', 'abandoned') then
    return v_order;
  end if;

  update public.stock_reservations
    set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';

  update public.orders
    set status = 'payment_failed', payment_status = p_payment_status
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('warning', 'Payment ' || p_payment_status || ' for order ' || v_order.order_number || '.');

  return v_order;
end;
$$;

revoke all on function public.mark_order_payment_failed(text, text) from public;
revoke all on function public.mark_order_payment_failed(text, text) from anon;
revoke all on function public.mark_order_payment_failed(text, text) from authenticated;
grant execute on function public.mark_order_payment_failed(text, text) to service_role;

-- ---------------------------------------------------------------------
-- 14. Successful payment finalisation
-- ---------------------------------------------------------------------
-- service_role only. Idempotent: calling this twice for the same
-- reference (a webhook retry landing after the callback-triggered
-- verification already finalised the order, or vice versa) is a safe
-- no-op the second time, returning the already-finalised order rather
-- than erroring or double-deducting stock.

create function public.finalize_successful_online_order(
  p_paystack_reference text,
  p_amount_paid numeric,
  p_paystack_transaction_id text
)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_reservation record;
  v_branch_name text;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_previous_quantity integer;
begin
  select * into v_order from public.orders where paystack_reference = p_paystack_reference for update;
  if not found then
    raise exception 'Order not found for reference %', p_paystack_reference;
  end if;

  if v_order.payment_status = 'successful' then
    return v_order;
  end if;

  if v_order.status not in ('pending_payment', 'payment_processing') then
    raise exception 'Order % is not awaiting payment (status %)', v_order.order_number, v_order.status;
  end if;

  if round(p_amount_paid, 2) <> round(v_order.amount_payable, 2) then
    raise exception 'Payment amount % does not match order total % for %',
      p_amount_paid, v_order.amount_payable, v_order.order_number;
  end if;

  if not exists (select 1 from public.stock_reservations where order_id = v_order.id and status = 'active') then
    raise exception 'No active reservations found for order %', v_order.order_number;
  end if;

  select name into v_branch_name from public.branches where id = v_order.branch_id;

  for v_reservation in
    select * from public.stock_reservations where order_id = v_order.id and status = 'active' order by product_id
  loop
    select reorder_level, name into v_reorder_level, v_product_name
      from public.products where id = v_reservation.product_id;

    select quantity into v_previous_quantity
      from public.product_stock
      where product_id = v_reservation.product_id and branch_id = v_reservation.branch_id
      for update;
    v_previous_quantity := coalesce(v_previous_quantity, 0);

    if v_previous_quantity < v_reservation.quantity then
      raise exception 'Insufficient physical stock to fulfil reservation for order %', v_order.order_number;
    end if;

    update public.product_stock
      set quantity = quantity - v_reservation.quantity
      where product_id = v_reservation.product_id and branch_id = v_reservation.branch_id
      returning quantity into v_new_quantity;

    update public.stock_reservations
      set status = 'fulfilled', fulfilled_at = now()
      where id = v_reservation.id;

    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (v_reservation.product_id, v_reservation.branch_id, 'out', v_reservation.quantity,
            'Website order ' || v_order.order_number, null);

    if v_new_quantity <= coalesce(v_reorder_level, 0) and v_previous_quantity > coalesce(v_reorder_level, 0) then
      insert into public.notifications (type, message)
      values (
        'warning',
        v_product_name || ' is running low on stock at ' || coalesce(v_branch_name, v_order.branch_id)
          || ' (' || v_new_quantity || ' left, reorder level ' || v_reorder_level || ').'
      );
    end if;
  end loop;

  update public.orders
    set payment_status = 'successful',
        status = 'paid',
        amount_paid = p_amount_paid,
        paid_at = now()
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values (
    'success',
    'New paid website order ' || v_order.order_number || ' at ' || coalesce(v_branch_name, v_order.branch_id)
      || ' (NGN ' || v_order.amount_payable || ').'
  );

  return v_order;
end;
$$;

revoke all on function public.finalize_successful_online_order(text, numeric, text) from public;
revoke all on function public.finalize_successful_online_order(text, numeric, text) from anon;
revoke all on function public.finalize_successful_online_order(text, numeric, text) from authenticated;
grant execute on function public.finalize_successful_online_order(text, numeric, text) to service_role;
