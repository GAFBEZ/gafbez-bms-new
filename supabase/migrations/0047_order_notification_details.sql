-- The Notifications tab's order alerts said only "New WhatsApp order
-- request GE-... at <branch>." / "New paid website order GE-... at
-- <branch> (NGN ...)." -- no customer name/contact and no idea what was
-- actually ordered without opening the order itself. Recreated with the
-- exact same bodies as 0045_quantity_aware_stock_messages.sql
-- (create_whatsapp_order) and 0031_combo_packages_installations_refunds_
-- credit.sql (finalize_successful_online_order), adding customer
-- name/contact, an item summary, and the total to each order-creation
-- notification message (newline-separated -- the BMS UI is updated
-- separately to render that as line breaks).

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

  select string_agg(quantity || 'x ' || product_name, ', ' order by product_name)
    into v_items_summary
    from public.order_items where order_id = v_order.id;

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

create or replace function public.finalize_successful_online_order(
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
  v_combo_details public.combo_order_details;
  v_items_summary text;
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

  -- Relaxed from 0030's unconditional check: a combo package built
  -- entirely from installation_service lines (no stock components at
  -- all) legitimately has zero order_items/reservations. Only raise when
  -- there SHOULD be active reservations (order_items exist) and there
  -- aren't any.
  if exists (select 1 from public.order_items where order_id = v_order.id)
     and not exists (select 1 from public.stock_reservations where order_id = v_order.id and status = 'active')
  then
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

  if v_order.store_credit_used > 0 then
    perform public.debit_store_credit_account(
      v_order.customer_id, v_order.store_credit_used, 'order_payment', v_order.id, null,
      'Applied to order ' || v_order.order_number, null
    );
  end if;

  update public.orders
    set payment_status = 'successful',
        status = 'paid',
        amount_paid = p_amount_paid + v_order.store_credit_used,
        paid_at = now()
    where id = v_order.id
    returning * into v_order;

  if v_order.order_type = 'combo_package' then
    select * into v_combo_details from public.combo_order_details where order_id = v_order.id;
    v_items_summary := v_combo_details.package_name;
  else
    select string_agg(quantity || 'x ' || product_name, ', ' order by product_name)
      into v_items_summary
      from public.order_items where order_id = v_order.id;
  end if;

  insert into public.notifications (type, message)
  values (
    'success',
    'New paid order ' || v_order.order_number || E'\n' ||
    'Customer: ' || v_order.customer_name || ' (' || coalesce(v_order.customer_phone, v_order.customer_email, 'no contact') || ')' || E'\n' ||
    'Branch: ' || coalesce(v_branch_name, v_order.branch_id) || E'\n' ||
    'Items: ' || coalesce(v_items_summary, '-') || E'\n' ||
    'Total: NGN ' || v_order.amount_paid
  );

  if v_order.order_type = 'combo_package' then
    insert into public.installation_jobs (order_id, combo_package_id, customer_id, branch_id, status, inspection_required)
    values (
      v_order.id, v_combo_details.combo_package_id, v_order.customer_id, v_order.branch_id,
      case when v_combo_details.inspection_required then 'site_inspection_required' else 'package_suitable' end,
      v_combo_details.inspection_required
    );

    insert into public.notifications (type, message)
    values (
      'info',
      'Package order ' || v_order.order_number || ' (' || v_combo_details.package_name || ') at '
        || coalesce(v_branch_name, v_order.branch_id) || ' is ready for site inspection scheduling.'
    );

    if v_order.upgrade_from_order_id is not null then
      perform public.finalize_package_upgrade_side_effects(v_order.id);
    end if;
  end if;

  return v_order;
end;
$$;
