-- Stage 7: Advanced Solar Load Calculator.
--
-- Scope note: the calculator's actual arithmetic (inverter/battery/solar
-- sizing) runs entirely client-side on the website (src/lib/calculator/*)
-- using only public, non-sensitive numbers -- there is nothing secret about
-- Ohm's law. This migration only adds the two pieces of *state* the
-- calculator needs from the database, both customer-owned:
--
--   1. customer_load_calculations -- a logged-in customer's saved
--      calculation (section 25 of the brief).
--   2. load_calculator_quotation_requests -- a "Request Quotation" lead,
--      available to anyone (see design note below), surfaced to staff via
--      the existing public.notifications table (0009_notifications.sql) so
--      no new BMS screen is needed for Stage 7.
--
-- Product/combo-package matching itself needs no new database objects at
-- all: it reads the already-safe public.website_catalogue /
-- get_website_catalogue_by_branch() (0028) and
-- get_website_combo_packages_by_branch() (0031), exactly as the shop and
-- combo-packages pages already do. Neither of those exposes cost_price,
-- profit, or supplier data, so the calculator's product recommendations
-- inherit that safety for free.
--
-- Design note -- quotation requests are anon+authenticated, unlike
-- create_whatsapp_order()/create_online_order_with_reservation() (0030),
-- which are authenticated-only: those two *reserve real stock* and create
-- a real order, so they need a verified account. A quotation request
-- changes no stock and creates no order -- it is a marketing lead, exactly
-- like being able to browse /shop and /combo-packages without logging in
-- -- so it stays open to anonymous visitors, same as the safe catalogue
-- RPCs it's built next to. The brief's "Customer name when logged in" /
-- "Customer phone when available" wording is read as "populate from the
-- profile when we have one", not "require login" -- if a stricter
-- authenticated-only policy is preferred, tighten the grant below and
-- require sign-in on the /load-calculator quotation form.
--
-- Naming/role note: same two-role schema as every prior stage (admin /
-- staff, see 0002_profiles.sql) -- "Owner/Admin" below means
-- public.is_admin(), "staff" means any authenticated profile.

-- ---------------------------------------------------------------------
-- 1. customer_load_calculations
-- ---------------------------------------------------------------------
-- All fields exactly as specified in the brief's section 25. Following the
-- write-only-through-functions convention established in Stage 6
-- (0031_combo_packages_installations_refunds_credit.sql): RLS below is
-- read-only, every insert/delete goes through save_load_calculation() /
-- delete_load_calculation() so validation lives in one place, in the
-- database, not just the client form.

create table public.customer_load_calculations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  branch_id text references public.branches (id),
  calculation_name text not null default 'My Calculation' check (btrim(calculation_name) <> ''),
  appliance_data jsonb not null check (jsonb_typeof(appliance_data) = 'array'),
  backup_hours numeric not null check (backup_hours > 0 and backup_hours <= 48),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  result_data jsonb not null check (jsonb_typeof(result_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_load_calculations is 'A logged-in customer''s saved load-calculator run. appliance_data/assumptions/result_data are plain JSON snapshots (same shape the website UI already computed) -- never re-derived server-side, never containing cost_price/profit/supplier data since the calculator never sees those in the first place.';

alter table public.customer_load_calculations enable row level security;

create policy "Customers can read their own saved calculations"
  on public.customer_load_calculations
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all saved calculations"
  on public.customer_load_calculations
  for select
  to authenticated
  using (public.is_admin());

-- Deliberately no insert/update/delete policy -- see save_load_calculation()
-- / delete_load_calculation() below. No update path at all: the brief's
-- rules (section 25) only ask for create + delete, not rename/edit, so
-- there is exactly one way to change what's saved -- delete and re-save.
grant select on public.customer_load_calculations to authenticated;

create function public.save_load_calculation(
  p_branch_id text,
  p_calculation_name text,
  p_appliance_data jsonb,
  p_backup_hours numeric,
  p_assumptions jsonb,
  p_result_data jsonb
)
returns public.customer_load_calculations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_row public.customer_load_calculations;
  v_existing_count integer;
begin
  if v_customer_id is null then
    raise exception 'You must be signed in to save a calculation';
  end if;

  if jsonb_typeof(p_appliance_data) is distinct from 'array' or jsonb_array_length(p_appliance_data) = 0 then
    raise exception 'Cannot save a calculation with no appliances';
  end if;

  if jsonb_typeof(p_assumptions) is distinct from 'object' then
    raise exception 'Assumptions must be a JSON object';
  end if;

  if jsonb_typeof(p_result_data) is distinct from 'object' then
    raise exception 'Result data must be a JSON object';
  end if;

  if p_backup_hours is null or p_backup_hours <= 0 or p_backup_hours > 48 then
    raise exception 'Backup hours must be greater than zero and within a safe range';
  end if;

  if p_branch_id is not null and not exists (select 1 from public.branches where id = p_branch_id) then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;

  select count(*) into v_existing_count
    from public.customer_load_calculations
    where customer_id = v_customer_id;

  if v_existing_count >= 30 then
    raise exception 'You have reached the maximum of 30 saved calculations. Delete one before saving another.';
  end if;

  insert into public.customer_load_calculations (
    customer_id, branch_id, calculation_name, appliance_data, backup_hours, assumptions, result_data
  ) values (
    v_customer_id,
    p_branch_id,
    coalesce(nullif(btrim(p_calculation_name), ''), 'My Calculation'),
    p_appliance_data,
    p_backup_hours,
    p_assumptions,
    p_result_data
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_load_calculation(text, text, jsonb, numeric, jsonb, jsonb) from public;
revoke all on function public.save_load_calculation(text, text, jsonb, numeric, jsonb, jsonb) from anon;
grant execute on function public.save_load_calculation(text, text, jsonb, numeric, jsonb, jsonb) to authenticated;

create function public.delete_load_calculation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.customer_load_calculations
    where id = p_id and customer_id = auth.uid();

  if not found then
    raise exception 'Calculation not found';
  end if;
end;
$$;

revoke all on function public.delete_load_calculation(uuid) from public;
revoke all on function public.delete_load_calculation(uuid) from anon;
grant execute on function public.delete_load_calculation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. load_calculator_quotation_requests
-- ---------------------------------------------------------------------
-- Section 24 of the brief. Same "write only through a function" shape as
-- above; the function also drops a row into the existing
-- public.notifications table so staff see it on their current Notifications
-- dashboard page without any new BMS screen.

create table public.load_calculator_quotation_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (btrim(customer_name) <> ''),
  customer_phone text not null check (btrim(customer_phone) <> ''),
  branch_id text not null references public.branches (id),
  appliance_data jsonb not null check (jsonb_typeof(appliance_data) = 'array'),
  backup_hours numeric not null check (backup_hours > 0 and backup_hours <= 48),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  result_data jsonb not null check (jsonb_typeof(result_data) = 'object'),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

comment on table public.load_calculator_quotation_requests is 'A "Request Quotation" lead from the public load calculator. result_data is the same customer-safe recommendation summary the calculator page already renders -- no cost_price, profit, or supplier data, since the calculator never has access to any of that in the first place.';

alter table public.load_calculator_quotation_requests enable row level security;

create policy "Customers can read their own quotation requests"
  on public.load_calculator_quotation_requests
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all quotation requests"
  on public.load_calculator_quotation_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's quotation requests"
  on public.load_calculator_quotation_requests
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and branch_id = load_calculator_quotation_requests.branch_id));

-- No insert/update/delete policy -- see submit_load_calculator_quotation_request() below.
grant select on public.load_calculator_quotation_requests to authenticated;

create function public.submit_load_calculator_quotation_request(
  p_branch_id text,
  p_customer_name text,
  p_customer_phone text,
  p_appliance_data jsonb,
  p_backup_hours numeric,
  p_assumptions jsonb,
  p_result_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_id uuid;
  v_branch_name text;
  v_summary text;
begin
  if btrim(coalesce(p_customer_name, '')) = '' or btrim(coalesce(p_customer_phone, '')) = '' then
    raise exception 'A name and phone number are required so our team can reach you';
  end if;

  select name into v_branch_name from public.branches where id = p_branch_id and status = 'active';
  if not found then
    raise exception 'Unknown or inactive branch: %', p_branch_id;
  end if;

  if jsonb_typeof(p_appliance_data) is distinct from 'array' or jsonb_array_length(p_appliance_data) = 0 then
    raise exception 'Cannot request a quotation with no appliances';
  end if;

  if jsonb_typeof(p_assumptions) is distinct from 'object' then
    raise exception 'Assumptions must be a JSON object';
  end if;

  if jsonb_typeof(p_result_data) is distinct from 'object' then
    raise exception 'Result data must be a JSON object';
  end if;

  if p_backup_hours is null or p_backup_hours <= 0 or p_backup_hours > 48 then
    raise exception 'Backup hours must be greater than zero and within a safe range';
  end if;

  insert into public.load_calculator_quotation_requests (
    customer_id, customer_name, customer_phone, branch_id, appliance_data, backup_hours, assumptions, result_data
  ) values (
    v_customer_id,
    btrim(p_customer_name),
    btrim(p_customer_phone),
    p_branch_id,
    p_appliance_data,
    p_backup_hours,
    p_assumptions,
    p_result_data
  )
  returning id into v_id;

  v_summary := coalesce(p_result_data ->> 'inverterSummary', 'see quotation request for details');

  insert into public.notifications (type, message)
  values (
    'info',
    btrim(p_customer_name) || ' (' || btrim(p_customer_phone) || ') requested a solar system quotation at '
      || coalesce(v_branch_name, p_branch_id) || ' via the load calculator. Recommended: ' || v_summary || '.'
  );

  return v_id;
end;
$$;

revoke all on function public.submit_load_calculator_quotation_request(text, text, text, jsonb, numeric, jsonb, jsonb) from public;
grant execute on function public.submit_load_calculator_quotation_request(text, text, text, jsonb, numeric, jsonb, jsonb) to anon, authenticated;
