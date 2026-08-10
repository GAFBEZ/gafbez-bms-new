-- Bug fix: 0039_installer_accounts.sql only added the installer-pricing
-- branch to create_online_order_with_reservation (the Paystack/online
-- checkout path). It missed create_whatsapp_order (0030_orders_and_
-- payments.sql section 9) -- the separate RPC used by the website's
-- "Continue on WhatsApp" pickup-only checkout button. An approved
-- installer placing a pickup/WhatsApp order was still being charged
-- products.website_price. This recreates create_whatsapp_order with the
-- exact same v_is_installer branch as create_online_order_with_
-- reservation, and sets orders.pricing_tier here too (added by 0039,
-- previously left at its 'retail' default for every WhatsApp order).

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

  -- Same pricing decision point as create_online_order_with_reservation.
  v_is_installer := (v_customer.installer_status = 'approved');

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
