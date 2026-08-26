-- get_installer_catalogue() (0057_quote_builder.sql) declares an `id`
-- output column via RETURNS TABLE, which PL/pgSQL also exposes as an
-- in-scope variable throughout the function body. The customer_profiles
-- lookup's `where id = auth.uid()` was therefore ambiguous between that
-- output variable and customer_profiles.id -- Postgres correctly refused
-- to guess (42702 column reference "id" is ambiguous). Fixed by aliasing
-- the table and qualifying every reference to it. The later products
-- query was never affected -- its columns were already qualified with
-- the `p` alias.

create or replace function public.get_installer_catalogue()
returns table (
  id uuid,
  sku text,
  name text,
  brand text,
  model text,
  category text,
  bonus_category text,
  unit text,
  short_description text,
  price numeric
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_customer public.customer_profiles;
begin
  select cp.* into v_customer
    from public.customer_profiles cp
    where cp.id = auth.uid();

  if not found then
    raise exception 'Customer profile not found';
  end if;

  if not (
    v_customer.installer_status = 'approved'
    or (v_customer.installer_status = 'temp_approved' and v_customer.installer_temp_approved_at > now() - interval '72 hours')
  ) then
    raise exception 'Installer pricing is not available on this account';
  end if;

  return query
    select
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.model,
      p.category,
      p.bonus_category,
      p.unit,
      p.short_description,
      p.selling_price
    from public.products p
    where p.is_active = true
    order by p.category, p.name;
end;
$$;
