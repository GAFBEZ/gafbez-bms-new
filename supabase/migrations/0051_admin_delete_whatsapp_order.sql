-- Admin-only hard delete for WhatsApp orders, requested so the business
-- can clear out rejected/expired requests instead of them sitting in the
-- log forever (see WhatsAppOrderRow.tsx / 0049_mark_whatsapp_order_paid.sql
-- for the rest of that page's actions).
--
-- Scoped tightly on purpose: only order_type = 'whatsapp_request' (this
-- action lives on the WhatsApp Orders page, not general order management),
-- and only status 'cancelled' (rejected) or 'expired' -- the two dead-end
-- states with no further business action possible. A request still
-- awaiting review, confirmed-and-reserved, or already paid/completed can
-- never be deleted here; those are live or historical business records.
--
-- order_items and stock_reservations both cascade on order_id (see
-- 0030_orders_and_payments.sql), so no manual cleanup is needed there. A
-- 'cancelled'/'expired' WhatsApp order never has a payment_events,
-- refund_requests, store_credit_ledger, or installation_jobs row against
-- it in practice (those only ever get created once an order is paid or
-- becomes an installation job) -- if one somehow did, the delete would
-- fail on that table's foreign key instead of silently losing financial
-- history, which is the right failure mode here.

create function public.delete_whatsapp_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner/Admin can delete a WhatsApp order';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.order_type <> 'whatsapp_request' then
    raise exception 'This action is only for WhatsApp orders';
  end if;

  if v_order.status not in ('cancelled', 'expired') then
    raise exception 'Only rejected or expired WhatsApp orders can be deleted';
  end if;

  delete from public.orders where id = v_order.id;
end;
$$;

revoke all on function public.delete_whatsapp_order(uuid) from public;
revoke all on function public.delete_whatsapp_order(uuid) from anon;
grant execute on function public.delete_whatsapp_order(uuid) to authenticated;
