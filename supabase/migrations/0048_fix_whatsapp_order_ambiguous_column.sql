-- Bug fix: 0047_order_notification_details.sql broke every WhatsApp
-- checkout with "column reference \"order_id\" is ambiguous" (SQLSTATE
-- 42702). create_whatsapp_order is declared `returns table (order_id
-- uuid, order_number text)`, which makes Postgres implicitly declare a
-- variable named order_id for that output column -- so the new
-- `from public.order_items where order_id = v_order.id` line couldn't
-- tell whether `order_id` meant that variable or the order_items column.
-- finalize_successful_online_order (recreated in the same migration)
-- doesn't have this problem, since it returns a plain public.orders row
-- rather than a named table, which is why only WhatsApp checkout broke.
-- Same body as 0047, just qualifying the column as order_items.order_id.

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
  v_items_summary text;
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

  select string_agg(order_items.quantity || 'x ' || order_items.product_name, ', ' order by order_items.product_name)
    into v_items_summary
    from public.order_items where order_items.order_id = v_order.id;

  insert into public.notifications (type, message)
  values (
    'info',
    'New WhatsApp order request ' || v_order.order_number || E'\n' ||
    'Customer: ' || v_customer.full_name || ' (' || coalesce(v_customer.phone, v_customer.email, 'no contact') || ')' || E'\n' ||
    'Branch: ' || coalesce((select name from public.branches where id = p_branch_id), p_branch_id) || E'\n' ||
    'Items: ' || coalesce(v_items_summary, '-') || E'\n' ||
    'Total: NGN ' || v_subtotal
  );

  return query select v_order.id, v_order.order_number;
end;
$$;
