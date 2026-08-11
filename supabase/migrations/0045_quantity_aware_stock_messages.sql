-- Bug fix: both checkout RPCs raised a flat "X is currently out of stock
-- at this branch" whenever the requested quantity exceeded what's
-- available -- even when some stock remained (e.g. 2 panels in stock, 10
-- requested). That's misleading: the item isn't out of stock, there just
-- isn't enough of it. Recreated with the exact same bodies as
-- 0042_installer_temp_approval.sql, changing only the exception raised
-- when v_available < v_quantity to distinguish "truly zero" (still "out
-- of stock") from "some left, just not enough" (now states the actual
-- count available, matching what the website now shows the customer
-- while they're picking a quantity -- see src/lib/cart/validate.ts).

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
      if v_available <= 0 then
        raise exception '% is currently out of stock at this branch', v_product.name;
      else
        raise exception 'Only % of % available at this branch -- please reduce the quantity', v_available, v_product.name;
      end if;
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
      if v_available <= 0 then
        raise exception '% is currently out of stock at this branch', v_product.name;
      else
        raise exception 'Only % of % available at this branch -- please reduce the quantity', v_available, v_product.name;
      end if;
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
