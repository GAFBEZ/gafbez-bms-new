-- Staff temporary installer approval: an Owner-designated, trusted staff
-- member can grant a *temporary* approval on a pending installer
-- application when the Owner/Admin isn't available, so the installer can
-- place an order at wholesale pricing right away. This is provisional --
-- it auto-expires after 72 hours if the Owner/Admin never finalizes it
-- (see the pricing eligibility check below), and only an Admin can turn
-- it into a permanent 'approved' (or reject it). Both the temporary
-- grant and the final decision record who did it, so "which staff
-- approved this" is always answerable.
--
-- profiles.can_temp_approve_installers follows the exact same pattern as
-- is_branch_manager/can_manage_installations (0031_combo_packages_
-- installations_refunds_credit.sql): a plain Owner-granted boolean, off
-- by default, toggled by the Owner directly in SQL -- no dedicated
-- Staff Management UI for it, matching how those two flags already work.

-- ---------------------------------------------------------------------
-- 1. profiles.can_temp_approve_installers
-- ---------------------------------------------------------------------

alter table public.profiles
  add column can_temp_approve_installers boolean not null default false;

comment on column public.profiles.can_temp_approve_installers is 'Owner-granted, off by default -- lets this staff member call temp_approve_installer_application() to provisionally unlock installer pricing on a pending application while the Owner/Admin is unavailable. The Owner sets this directly (update public.profiles set can_temp_approve_installers = true where id = ...), same as is_branch_manager/can_manage_installations.';

-- ---------------------------------------------------------------------
-- 2. customer_profiles: temp-approval columns + widened installer_status
-- ---------------------------------------------------------------------

alter table public.customer_profiles
  add column installer_temp_approved_by uuid references auth.users (id),
  add column installer_temp_approved_at timestamptz;

comment on column public.customer_profiles.installer_temp_approved_by is 'Staff auth.users.id who granted a temporary approval -- set by temp_approve_installer_application only. Kept even after final review, as an audit trail of who made the provisional call.';
comment on column public.customer_profiles.installer_temp_approved_at is 'When temp_approve_installer_application was called. Installer pricing eligibility (create_online_order_with_reservation/create_whatsapp_order) only honours a temp_approved status within 72 hours of this timestamp -- past that, pricing silently reverts to retail until an Admin finalizes it, without needing a cron job to flip the status column itself.';

alter table public.customer_profiles
  drop constraint if exists customer_profiles_installer_status_check;

alter table public.customer_profiles
  add constraint customer_profiles_installer_status_check
  check (installer_status in ('none', 'pending', 'approved', 'rejected', 'temp_approved'));

-- The existing select RLS on customer_profiles (0029_customer_accounts_
-- and_cart.sql) only allows a customer to read their own row or
-- is_admin() to read every row -- a trusted-but-non-admin staff member
-- (can_temp_approve_installers) would see zero rows on the Installer
-- Applications page without this. Scoped to installer_status <> 'none'
-- only -- this does not open up general customer browsing, just the
-- applications this staff member is specifically trusted to review.
create policy "Trusted staff can read installer applications"
  on public.customer_profiles
  for select
  to authenticated
  using (
    installer_status <> 'none'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and can_temp_approve_installers
    )
  );

-- ---------------------------------------------------------------------
-- 3. temp_approve_installer_application: the new staff-facing RPC
-- ---------------------------------------------------------------------

create function public.temp_approve_installer_application(p_customer_id uuid)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer public.customer_profiles;
  v_caller_authorized boolean;
begin
  select (role = 'admin' or can_temp_approve_installers) into v_caller_authorized
    from public.profiles where id = auth.uid();

  if not coalesce(v_caller_authorized, false) then
    raise exception 'You are not authorized to grant temporary installer approval';
  end if;

  select * into v_customer from public.customer_profiles where id = p_customer_id for update;
  if not found then
    raise exception 'Installer applicant not found';
  end if;
  if v_customer.installer_status <> 'pending' then
    raise exception 'This application is not awaiting review';
  end if;

  update public.customer_profiles
    set installer_status = 'temp_approved',
        installer_temp_approved_by = auth.uid(),
        installer_temp_approved_at = now()
    where id = p_customer_id
    returning * into v_customer;

  insert into public.notifications (type, message)
  values ('info', 'Installer application temporarily approved for ' || coalesce(v_customer.business_name, v_customer.full_name) || ' -- needs Owner/Admin final review within 72 hours.');

  return v_customer;
end;
$$;

revoke all on function public.temp_approve_installer_application(uuid) from public;
grant execute on function public.temp_approve_installer_application(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. approve_installer_application / reject_installer_application:
--    broaden the status-transition guard to also accept 'temp_approved'
--    (finalizing a staff temp-approval), not just 'pending'. Everything
--    else about these two is unchanged from 0039_installer_accounts.sql
--    -- still is_admin()-only, still row-locked, still refuse an
--    already-finalized row.
-- ---------------------------------------------------------------------

create or replace function public.approve_installer_application(p_customer_id uuid)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer public.customer_profiles;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner/Admin can approve installer applications';
  end if;

  select * into v_customer from public.customer_profiles where id = p_customer_id for update;
  if not found then
    raise exception 'Installer applicant not found';
  end if;
  if v_customer.installer_status not in ('pending', 'temp_approved') then
    raise exception 'This application has already been reviewed';
  end if;

  update public.customer_profiles
    set installer_status = 'approved',
        installer_reviewed_by = auth.uid(),
        installer_reviewed_at = now(),
        installer_rejection_reason = null
    where id = p_customer_id
    returning * into v_customer;

  insert into public.notifications (type, message)
  values ('success', 'Installer application approved for ' || coalesce(v_customer.business_name, v_customer.full_name) || '.');

  return v_customer;
end;
$$;

create or replace function public.reject_installer_application(p_customer_id uuid, p_reason text)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer public.customer_profiles;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner/Admin can reject installer applications';
  end if;

  select * into v_customer from public.customer_profiles where id = p_customer_id for update;
  if not found then
    raise exception 'Installer applicant not found';
  end if;
  if v_customer.installer_status not in ('pending', 'temp_approved') then
    raise exception 'This application has already been reviewed';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.customer_profiles
    set installer_status = 'rejected',
        installer_rejection_reason = p_reason,
        installer_reviewed_by = auth.uid(),
        installer_reviewed_at = now()
    where id = p_customer_id
    returning * into v_customer;

  insert into public.notifications (type, message)
  values ('info', 'Installer application rejected for ' || coalesce(v_customer.business_name, v_customer.full_name) || '.');

  return v_customer;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Pricing eligibility: honour a still-fresh temp_approved status too
-- ---------------------------------------------------------------------
-- Both functions recreated with the same one-line change to v_is_installer
-- -- everything else is byte-identical to 0039 (create_online_order_with_
-- reservation) / 0041 (create_whatsapp_order).

create or replace function public.create_online_order_with_reservation(
  p_branch_id text,
  p_items jsonb,
  p_idempotency_key text default null,
  p_store_credit_requested numeric default 0
)
returns table (
  order_id uuid,
  order_number text,
  paystack_reference text,
  amount_payable numeric,
  store_credit_applied numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_customer public.customer_profiles;
  v_is_installer boolean := false;
  v_branch_status text;
  v_expiry_minutes integer;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products;
  v_unit_price numeric;
  v_physical_stock integer;
  v_special_order_quantity integer;
  v_reserved integer;
  v_available integer;
  v_subtotal numeric := 0;
  v_order public.orders;
  v_order_number text;
  v_reference text;
  v_order_item_id uuid;
  v_expires_at timestamptz;
  v_available_credit numeric;
  v_credit_to_use numeric;
  v_amount_payable numeric;
  v_payment_method text;
begin
  if v_customer_id is null then
    raise exception 'You must be logged in to check out';
  end if;

  if p_idempotency_key is not null then
    select * into v_order
      from public.orders
      where customer_id = v_customer_id and client_idempotency_key = p_idempotency_key;

    if found then
      return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
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

  -- The one and only pricing decision point for this whole order. A
  -- staff temp_approved status only counts within 72 hours of the grant
  -- -- past that it silently reverts to retail until an Admin finalizes
  -- it (see column comment on installer_temp_approved_at).
  v_is_installer := (
    v_customer.installer_status = 'approved'
    or (v_customer.installer_status = 'temp_approved' and v_customer.installer_temp_approved_at > now() - interval '72 hours')
  );

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

    v_unit_price := case when v_is_installer then v_product.selling_price else v_product.website_price end;

    select quantity, special_order_quantity into v_physical_stock, v_special_order_quantity
      from public.product_stock
      where product_id = v_product_id and branch_id = p_branch_id
      for update;
    v_physical_stock := greatest(coalesce(v_physical_stock, 0), coalesce(v_special_order_quantity, 0));

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_product_id and branch_id = p_branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_quantity then
      raise exception '% is no longer available in the requested quantity at this branch', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  v_available_credit := public.get_available_store_credit(v_customer_id);
  v_credit_to_use := least(greatest(coalesce(p_store_credit_requested, 0), 0), v_available_credit, v_subtotal);
  v_amount_payable := v_subtotal - v_credit_to_use;
  v_payment_method := case when v_amount_payable = 0 then 'store_credit' else 'paystack' end;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_reference := v_order_number;

  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, store_credit_used, amount_payable, customer_name, customer_email, customer_phone,
    paystack_reference, reservation_expires_at, client_idempotency_key, pricing_tier
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'online_payment', 'pending_payment', 'unpaid', v_payment_method,
    v_subtotal, v_credit_to_use, v_amount_payable, v_customer.full_name, v_customer.email, v_customer.phone,
    v_reference, v_expires_at, p_idempotency_key,
    case when v_is_installer then 'installer' else 'retail' end
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products where id = v_product_id;
    v_unit_price := case when v_is_installer then v_product.selling_price else v_product.website_price end;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, v_unit_price, v_quantity,
      v_unit_price * v_quantity
    )
    returning id into v_order_item_id;

    insert into public.stock_reservations (
      order_id, order_item_id, product_id, branch_id, quantity, status, expires_at
    ) values (
      v_order.id, v_order_item_id, v_product.id, p_branch_id, v_quantity, 'active', v_expires_at
    );
  end loop;

  if v_amount_payable = 0 then
    perform public.finalize_successful_online_order(v_reference, 0, 'STORE_CREDIT_ONLY');
    select * into v_order from public.orders where id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
end;
$$;

create or replace function public.create_whatsapp_order(
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
  v_is_installer boolean := false;
  v_branch_status text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products;
  v_unit_price numeric;
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

  v_is_installer := (
    v_customer.installer_status = 'approved'
    or (v_customer.installer_status = 'temp_approved' and v_customer.installer_temp_approved_at > now() - interval '72 hours')
  );

  select status into v_branch_status from public.branches where id = p_branch_id;
  if not found or v_branch_status <> 'active' then
    raise exception 'Selected branch is not available';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

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

    v_unit_price := case when v_is_installer then v_product.selling_price else v_product.website_price end;

    v_available := public.get_available_to_sell(v_product_id, p_branch_id);
    if v_available < v_quantity then
      raise exception '% is currently out of stock at this branch', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, amount_payable, customer_name, customer_email, customer_phone, pricing_tier
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'whatsapp_request', 'whatsapp_review_required', 'unpaid', 'whatsapp',
    v_subtotal, v_subtotal, v_customer.full_name, v_customer.email, v_customer.phone,
    case when v_is_installer then 'installer' else 'retail' end
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products where id = v_product_id;
    v_unit_price := case when v_is_installer then v_product.selling_price else v_product.website_price end;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, v_unit_price, v_quantity,
      v_unit_price * v_quantity
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
