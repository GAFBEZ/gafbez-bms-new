-- Approval-gated installer accounts: a customer can check "I'm an
-- installer" at signup and give a business name. Their account starts
-- installer_status = 'pending' -- retail (website_price) pricing still
-- applies to them until a staff Admin approves the application. Once
-- approved, create_online_order_with_reservation silently charges that
-- customer products.selling_price (BMS/internal price) instead of
-- website_price -- nothing about what's displayed while browsing/in cart
-- changes for anyone (that stays retail for all customers, an explicit
-- product decision -- see the website's shop/product pages and
-- getCatalogueByBranch/validateCart, none of which are touched here).
--
-- Single-tier approve/reject, no multi-stage state machine (unlike
-- refund_requests' Manager-then-Owner flow) -- so this stores state as
-- columns directly on customer_profiles rather than a separate
-- installer_applications table. is_installer_applicant is the permanent
-- "did they check the box at signup" fact; installer_status is the
-- mutable review-workflow state. No reapplication flow in v1: once
-- reviewed (approved or rejected), the two RPCs below refuse to touch
-- that row again.

-- ---------------------------------------------------------------------
-- 1. New customer_profiles columns
-- ---------------------------------------------------------------------

alter table public.customer_profiles
  add column is_installer_applicant boolean not null default false,
  add column business_name text,
  add column installer_status text not null default 'none'
    check (installer_status in ('none', 'pending', 'approved', 'rejected')),
  add column installer_reviewed_by uuid references auth.users (id),
  add column installer_reviewed_at timestamptz,
  add column installer_rejection_reason text;

alter table public.customer_profiles
  add constraint customer_profiles_installer_business_name_check
  check (installer_status = 'none' or nullif(btrim(business_name), '') is not null);

comment on column public.customer_profiles.is_installer_applicant is 'Set once, at signup, from the website''s "I''m an installer" checkbox. Never changed afterward -- the mutable review state lives in installer_status.';
comment on column public.customer_profiles.business_name is 'Required (see check constraint) once installer_status leaves ''none''. Never shown to other customers.';
comment on column public.customer_profiles.installer_status is 'none = never applied. pending = applied, awaiting staff review (retail pricing still applies). approved = staff-approved -- create_online_order_with_reservation charges this customer products.selling_price instead of products.website_price, invisibly, only at that final trusted calculation. rejected = staff-rejected, see installer_rejection_reason. No reapplication flow in v1 -- approve/reject_installer_application both refuse a non-pending row.';
comment on column public.customer_profiles.installer_reviewed_by is 'Staff auth.users.id who approved/rejected -- set by approve_installer_application/reject_installer_application only.';

-- ---------------------------------------------------------------------
-- 2. handle_new_customer(): read the two new signup fields
-- ---------------------------------------------------------------------
-- Same trigger, same signature as 0029_customer_accounts_and_cart.sql --
-- create or replace, no drop needed, existing trigger keeps pointing at
-- it. Only change: is_installer_applicant/business_name/installer_status
-- are read from raw_user_meta_data alongside the existing fields.

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_is_installer_applicant boolean;
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    v_is_installer_applicant := coalesce((new.raw_user_meta_data ->> 'is_installer_applicant')::boolean, false);

    insert into public.customer_profiles (
      id, full_name, email, phone, phone_normalized, email_verified,
      is_installer_applicant, business_name, installer_status
    )
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer'),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone_normalized'), ''),
      new.email_confirmed_at is not null,
      v_is_installer_applicant,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'business_name'), '') else null end,
      case when v_is_installer_applicant then 'pending' else 'none' end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Staff review RPCs -- same shape as manager_approve_refund_request/
--    reject_refund_request (0031_combo_packages_installations_refunds_
--    credit.sql): security definer, row lock, status-transition guard,
--    update ... returning * into ..., insert into public.notifications,
--    revoke all from public + grant execute to authenticated (the
--    is_admin() check inside is the real gate).
-- ---------------------------------------------------------------------

create function public.approve_installer_application(p_customer_id uuid)
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
  if v_customer.installer_status <> 'pending' then
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

revoke all on function public.approve_installer_application(uuid) from public;
grant execute on function public.approve_installer_application(uuid) to authenticated;

create function public.reject_installer_application(p_customer_id uuid, p_reason text)
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
  if v_customer.installer_status <> 'pending' then
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

revoke all on function public.reject_installer_application(uuid, text) from public;
grant execute on function public.reject_installer_application(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. orders.pricing_tier -- staff-facing audit trail only
-- ---------------------------------------------------------------------
-- Since the installer discount is applied completely invisibly (no UI
-- ever shows it), there would otherwise be no way for staff to later
-- tell, from an order alone, whether it was billed at retail or
-- wholesale. This is a plain audit column -- nothing reads or displays
-- it on the website.

alter table public.orders
  add column pricing_tier text not null default 'retail'
    check (pricing_tier in ('retail', 'installer'));

comment on column public.orders.pricing_tier is 'Set by create_online_order_with_reservation from the ordering customer''s installer_status at checkout time. ''installer'' means subtotal/order_items.website_price were computed from products.selling_price, not products.website_price. Staff-facing only -- never surfaced on the website.';

-- ---------------------------------------------------------------------
-- 5. create_online_order_with_reservation: installer pricing branch
-- ---------------------------------------------------------------------
-- Same signature as 0036_special_order_quantity.sql's version (still 4
-- args, still create or replace, no drop needed -- existing grants carry
-- over). Every line is unchanged from that version except: two new
-- declared variables (v_is_installer, v_unit_price), one new assignment
-- right after the customer/profile-completeness checks, the subtotal
-- line in the validation loop, the order insert's column list (adds
-- pricing_tier), and the order_items insert in the second loop.

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

  -- The one and only pricing decision point for this whole order.
  -- Nothing upstream of this (cart, product pages, catalogue RPCs) knows
  -- or cares about this -- it only affects the two price reads below.
  v_is_installer := (v_customer.installer_status = 'approved');

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

    -- Installer branch. website_price is still the eligibility gate
    -- above (a product with no website_price isn't sellable online at
    -- all, installer or not) -- only which figure gets charged changes.
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

  -- Store credit clamp (section 26/27): never more than requested, never
  -- more than what's actually available right now (balance minus what
  -- the customer's other in-flight orders are already holding), never
  -- more than the order itself costs.
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

  -- Section 28: fully covered by store credit -- finalise right now,
  -- inside this same transaction, instead of ever calling Paystack.
  if v_amount_payable = 0 then
    perform public.finalize_successful_online_order(v_reference, 0, 'STORE_CREDIT_ONLY');
    select * into v_order from public.orders where id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
end;
$$;
