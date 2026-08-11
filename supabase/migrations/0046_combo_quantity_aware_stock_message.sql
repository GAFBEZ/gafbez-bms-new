-- Same fix as 0045_quantity_aware_stock_messages.sql, for the combo
-- package checkout path. create_combo_order_with_reservations raised a
-- generic "one or more components are out of stock" without naming which
-- component or how many are actually available -- worse than the plain
-- product checkout's old message, since it didn't even identify the
-- specific item. Recreated with the exact same body as
-- 0036_special_order_quantity.sql, changing only the Pass 1 stock check:
-- now names the component (via combo_package_components.display_name,
-- the same customer-facing name already used in the components snapshot
-- a few lines below) and, when some stock remains but not enough, states
-- the count available.

create or replace function public.create_combo_order_with_reservations(
  p_package_id uuid,
  p_branch_id text,
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
  v_branch_status text;
  v_expiry_minutes integer;
  v_package public.combo_packages;
  v_component record;
  v_physical_stock integer;
  v_special_order_quantity integer;
  v_reserved integer;
  v_available integer;
  v_order public.orders;
  v_order_number text;
  v_reference text;
  v_order_item_id uuid;
  v_expires_at timestamptz;
  v_available_credit numeric;
  v_credit_to_use numeric;
  v_amount_payable numeric;
  v_payment_method text;
  v_components_snapshot jsonb;
  v_product public.products;
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

  select status into v_branch_status from public.branches where id = p_branch_id;
  if not found or v_branch_status <> 'active' then
    raise exception 'Selected branch is not available';
  end if;

  select * into v_package from public.combo_packages where id = p_package_id;
  if not found or not v_package.is_active or not v_package.is_visible_on_website then
    raise exception 'This package is no longer available';
  end if;

  select reservation_expiry_minutes into v_expiry_minutes from public.app_settings;
  v_expiry_minutes := coalesce(v_expiry_minutes, 30);
  v_expires_at := now() + make_interval(mins => v_expiry_minutes);

  -- Pass 1: lock and validate every stock-backed component (fixed lock
  -- ordering by product_id, same reasoning as create_online_order_with_
  -- reservation -- a customer buying two different packages that happen
  -- to share a component product must never be able to deadlock against
  -- another checkout). Non-stock installation_service lines have no
  -- product_id and nothing to lock or check here.
  for v_component in
    select c.product_id, c.quantity, c.display_name
    from public.combo_package_components c
    where c.combo_package_id = p_package_id and c.product_id is not null
    order by c.product_id
  loop
    select quantity, special_order_quantity into v_physical_stock, v_special_order_quantity
      from public.product_stock
      where product_id = v_component.product_id and branch_id = p_branch_id
      for update;
    v_physical_stock := greatest(coalesce(v_physical_stock, 0), coalesce(v_special_order_quantity, 0));

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_component.product_id and branch_id = p_branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_component.quantity then
      if v_available <= 0 then
        raise exception '% (part of this package) is currently out of stock at this branch', v_component.display_name;
      else
        raise exception 'Only % of % (part of this package) available at this branch -- this package cannot be fulfilled right now', v_available, v_component.display_name;
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', c.display_name,
      'sku', p.sku,
      'quantity', c.quantity,
      'componentType', c.component_type
    ) order by c.display_order, c.display_name
  ), '[]'::jsonb)
    into v_components_snapshot
    from public.combo_package_components c
    left join public.products p on p.id = c.product_id
    where c.combo_package_id = p_package_id;

  v_available_credit := public.get_available_store_credit(v_customer_id);
  v_credit_to_use := least(greatest(coalesce(p_store_credit_requested, 0), 0), v_available_credit, v_package.final_price);
  v_amount_payable := v_package.final_price - v_credit_to_use;
  v_payment_method := case when v_amount_payable = 0 then 'store_credit' else 'paystack' end;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_reference := v_order_number;

  -- Pass 2: still holding every component lock from Pass 1 -- create the
  -- order, its snapshot, its order_items, and their reservations together.
  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, store_credit_used, amount_payable, customer_name, customer_email, customer_phone,
    paystack_reference, reservation_expires_at, client_idempotency_key
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'combo_package', 'pending_payment', 'unpaid', v_payment_method,
    v_package.final_price, v_credit_to_use, v_amount_payable, v_customer.full_name, v_customer.email, v_customer.phone,
    v_reference, v_expires_at, p_idempotency_key
  )
  returning * into v_order;

  insert into public.combo_order_details (
    order_id, combo_package_id, package_code, package_name, package_slug, final_price,
    system_capacity_text, appliances_supported, installation_scope, warranty_text,
    inspection_required, components, branch_id, quantity
  ) values (
    v_order.id, v_package.id, v_package.package_code, v_package.name, v_package.website_slug, v_package.final_price,
    v_package.system_capacity_text, v_package.appliances_supported, v_package.installation_scope, v_package.warranty_text,
    v_package.inspection_required, v_components_snapshot, p_branch_id, 1
  );

  for v_component in
    select c.product_id, c.quantity
    from public.combo_package_components c
    where c.combo_package_id = p_package_id and c.product_id is not null
  loop
    select * into v_product from public.products where id = v_component.product_id;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      -- website_price/line_total are deliberately 0 here, never the
      -- component's real price -- "customers must never see individual
      -- component cost/profit" (section 1/2). The customer-facing total
      -- is combo_order_details.final_price / orders.amount_payable.
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, 0, v_component.quantity, 0
    )
    returning id into v_order_item_id;

    insert into public.stock_reservations (
      order_id, order_item_id, product_id, branch_id, quantity, status, expires_at
    ) values (
      v_order.id, v_order_item_id, v_product.id, p_branch_id, v_component.quantity, 'active', v_expires_at
    );
  end loop;

  if v_amount_payable = 0 then
    perform public.finalize_successful_online_order(v_reference, 0, 'STORE_CREDIT_ONLY');
    select * into v_order from public.orders where id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
end;
$$;
