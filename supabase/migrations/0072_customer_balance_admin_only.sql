-- outstanding_balance was a plain editable column with no protection --
-- any staff member could set any customer's balance to anything via
-- updateCustomer, even though it's meant to move only through an actual
-- sale/return (record_sale/record_return already adjust it directly).
--
-- A BEFORE INSERT/UPDATE trigger is used instead of an RLS WITH CHECK
-- clause because comparing NEW against OLD isn't expressible there for
-- UPDATE -- OLD isn't visible in a WITH CHECK expression. The app-level
-- check in src/app/dashboard/customers/actions.ts already keeps the UI
-- from letting a non-admin submit a different value; this is the
-- enforcement that holds even if that action is ever bypassed.
--
-- Plain SECURITY INVOKER (no elevated privilege), same reasoning as
-- is_admin() itself (0008_role_enforcement.sql): it only needs to read
-- the calling user's own profile, which they can already do.
create function public.protect_customer_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.outstanding_balance := 0;
  else
    new.outstanding_balance := old.outstanding_balance;
  end if;

  return new;
end;
$$;

create trigger protect_customer_balance
  before insert or update on public.customers
  for each row execute procedure public.protect_customer_balance();
