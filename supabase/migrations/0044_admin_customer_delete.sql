-- Admin-triggered deactivate/delete for website customers (and, since
-- installer applicants are just customer_profiles rows too, installers).
--
-- Deactivate is the safe, always-available option: same effect as the
-- customer's own self-service deactivate_customer_account()
-- (0029_customer_accounts_and_cart.sql) -- sets is_active = false,
-- doesn't touch any order/refund/store-credit/installation history --
-- just parametrized by p_customer_id and gated on is_admin() instead of
-- auth.uid()-only.
--
-- Hard delete has no RPC here on purpose: deleting a customer_profiles
-- row means deleting the underlying auth.users row (it cascades from
-- there, see 0029), which is a Supabase Auth Admin API call
-- (auth.admin.deleteUser), not something a Postgres function can do.
-- That happens from the Server Action in websiteCustomerActions.ts using
-- the service-role client, after first confirming (via plain counts
-- against orders/store_credit_accounts/store_credit_ledger/
-- installation_jobs/refund_requests -- the five tables that reference
-- customer_profiles without ON DELETE CASCADE) that deleting won't
-- silently destroy financial/business records. If any of those exist,
-- the action refuses and tells the admin to deactivate instead.

create function public.admin_deactivate_customer_account(p_customer_id uuid)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer public.customer_profiles;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner/Admin can deactivate a customer account';
  end if;

  update public.customer_profiles
    set is_active = false
    where id = p_customer_id and is_active = true
    returning * into v_customer;

  if not found then
    select * into v_customer from public.customer_profiles where id = p_customer_id;
    if not found then
      raise exception 'Customer not found';
    end if;
    -- Already inactive -- return the current row rather than erroring,
    -- so the UI can treat this as a no-op success.
    return v_customer;
  end if;

  insert into public.customer_profile_audit (customer_id, event_type, old_value, new_value)
  values (p_customer_id, 'account_deactivated', 'active', 'inactive');

  return v_customer;
end;
$$;

revoke all on function public.admin_deactivate_customer_account(uuid) from public;
grant execute on function public.admin_deactivate_customer_account(uuid) to authenticated;
