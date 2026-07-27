-- Stage 6: Combo Packages, Site Inspection, Refunds & Store Credit.
--
-- Inspected before writing this migration: 0028_website_catalogue.sql
-- (is_combo_eligible already exists on products, unused until now),
-- 0029_customer_accounts_and_cart.sql (customer_profiles, cart), and
-- 0030_orders_and_payments.sql (orders/order_items/stock_reservations/
-- payment_events, get_available_to_sell, the online-order and WhatsApp
-- order flows, Paystack finalisation). Builds directly on top of that --
-- a combo package purchase reuses the exact same orders/order_items/
-- stock_reservations/finalize_successful_online_order machinery a regular
-- product order uses, rather than inventing a parallel payment pipeline.
--
-- ROLE MODEL DEVIATION (read this first -- it affects most of the RLS/
-- function checks below): this schema has never had a 'manager' or
-- 'owner' role (see 0002_profiles.sql/0008_role_enforcement.sql: role is
-- 'admin' or 'staff', full stop -- 0028's own header comment already
-- called this out for "Owner/Admin" vs "Manager/Salesperson" wording).
-- Stage 6's brief leans heavily on a real Owner/Manager/Salesperson
-- distinction (refund approval tiers, package-price protection,
-- installation-workflow permissions), so this migration extends the role
-- model minimally rather than reinterpreting everything as admin/staff
-- again:
--   * "Owner" = public.is_admin() (role = 'admin'), unchanged.
--   * "Manager" = a new profiles.is_branch_manager flag, meaningful only
--     together with an assigned branch_id.
--   * "Salesperson" = any other non-admin staff account.
--   * A separate profiles.can_manage_installations flag lets an Owner
--     opt a specific salesperson into installation-workflow actions
--     ("Salespeople may only act if ... the Owner approves that access").
-- Both flags default to false and are additive columns, not a change to
-- the existing role check constraint -- nothing that already checks
-- role = 'admin' anywhere in the app is affected.

alter table public.profiles add column if not exists is_branch_manager boolean not null default false;
alter table public.profiles add column if not exists can_manage_installations boolean not null default false;

comment on column public.profiles.is_branch_manager is 'Stage 6: marks a non-admin staff account as the Manager of their assigned branch_id. Meaningless without branch_id set. See this migration''s header comment for why this exists instead of a real "manager" role value.';
comment on column public.profiles.can_manage_installations is 'Stage 6: Owner-granted permission letting a non-manager branch staff member (a "salesperson") act on that branch''s installation_jobs. Off by default.';

-- Only admins may grant/revoke these -- same privilege-escalation concern
-- 0011_staff_management.sql already solved for role/branch_id/is_active,
-- extended to cover the two new flags.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.branch_id is distinct from old.branch_id
      or new.is_active is distinct from old.is_active
      or new.is_branch_manager is distinct from old.is_branch_manager
      or new.can_manage_installations is distinct from old.can_manage_installations)
     and not public.is_admin() then
    raise exception 'Only admins can change role, branch, active status, or staff permissions';
  end if;
  return new;
end;
$$;

-- True for the Owner (any branch) or that branch's Manager. Mirrors the
-- branch-lock pattern record_sale()/record_stock_movement() already use
-- (0023_branch_locked_staff.sql), just keyed on is_branch_manager instead
-- of "any non-admin staff".
create function public.can_manage_branch(p_branch_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or (is_branch_manager and branch_id = p_branch_id))
  );
$$;

-- True for the Owner, that branch's Manager, or a salesperson at that
-- branch the Owner has explicitly opted into installation work.
create function public.can_act_on_installation(p_branch_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and branch_id = p_branch_id
      and (role = 'admin' or is_branch_manager or can_manage_installations)
  );
$$;

-- ---------------------------------------------------------------------
-- 1. combo_packages
-- ---------------------------------------------------------------------
-- A fixed, non-customisable bundle. Composition lives in
-- combo_package_components below; this row is the sellable "product" a
-- customer sees on the website. No cost/profit column exists here on
-- purpose -- see section 5's Owner-only profit view further down, which
-- computes it on the fly from products.cost_price instead of storing it
-- twice.

create table public.combo_packages (
  id uuid primary key default gen_random_uuid(),
  package_code text not null unique,
  name text not null check (btrim(name) <> ''),
  website_slug text not null unique,
  short_description text,
  full_description text,
  main_image_url text,
  gallery_image_urls jsonb not null default '[]'::jsonb,
  final_price numeric(14, 2) not null check (final_price >= 0),
  system_capacity_text text,
  capacity_rank integer not null default 0,
  appliances_supported jsonb not null default '[]'::jsonb,
  installation_scope text,
  warranty_text text,
  inspection_required boolean not null default true,
  is_active boolean not null default true,
  is_visible_on_website boolean not null default false,
  is_featured boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint combo_packages_gallery_is_array check (jsonb_typeof(gallery_image_urls) = 'array'),
  constraint combo_packages_appliances_is_array check (jsonb_typeof(appliances_supported) = 'array')
);

comment on table public.combo_packages is 'Fixed solar installation bundles sold on the website. Final price is the only price a customer ever sees -- component-level cost/selling price never appears here.';
comment on column public.combo_packages.capacity_rank is 'Editable ordinal used only to compare packages for the "recommend a higher-capacity package" flow (installation_jobs.recommended_package_id) -- higher number means higher capacity. Not shown to customers.';

create trigger set_combo_packages_updated_at
  before update on public.combo_packages
  for each row execute procedure public.set_updated_at();

alter table public.combo_packages enable row level security;

create policy "Public can read visible combo packages"
  on public.combo_packages
  for select
  to anon, authenticated
  using (is_active = true and is_visible_on_website = true);

-- Section 5: "Managers may view package definitions." Deliberately no
-- write policy at all here (for anyone, including admins) -- every write
-- goes through create_combo_package/update_combo_package/
-- set_combo_package_status below, all of which are admin-only. That keeps
-- "only Owner/Admin can create or edit package prices and components" a
-- single enforced choke point instead of relying on RLS to also carve out
-- a manager exception, which this stage doesn't implement (see section 5
-- of STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md for why "operational status"
-- editing by Managers was left out rather than half-built).
create policy "Staff can read all combo packages"
  on public.combo_packages
  for select
  to authenticated
  using (true);

grant select on public.combo_packages to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. combo_package_components
-- ---------------------------------------------------------------------

create table public.combo_package_components (
  id uuid primary key default gen_random_uuid(),
  combo_package_id uuid not null references public.combo_packages (id) on delete cascade,
  product_id uuid references public.products (id),
  quantity integer not null check (quantity > 0),
  component_type text not null check (component_type in (
    'inverter', 'battery', 'solar_panel', 'accessory', 'installation_service', 'other'
  )),
  is_required boolean not null default true,
  display_name text not null check (btrim(display_name) <> ''),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint combo_package_components_product_required check (
    (component_type = 'installation_service' and product_id is null)
    or (component_type <> 'installation_service' and product_id is not null)
  )
);

comment on table public.combo_package_components is 'What a fixed package contains. No price column -- component cost/selling price is only ever read from public.products (Owner-only, see the profit view in this migration), never duplicated here. A purchase snapshots name/sku/quantity into combo_order_details, so editing a package later never rewrites past orders.';

-- "Prevent duplicate component rows where appropriate": one row per real
-- product per package. Non-stock service lines (product_id null) are
-- exempt -- a package could reasonably list two different service lines.
create unique index combo_package_components_unique_product
  on public.combo_package_components (combo_package_id, product_id)
  where product_id is not null;

create index combo_package_components_package_id_idx on public.combo_package_components (combo_package_id);

alter table public.combo_package_components enable row level security;

-- No anon policy at all (section 4: don't grant anonymous access to the
-- component tables). Staff-wide read so Managers can see composition;
-- writes are admin-only, always through the package functions below.
create policy "Staff can read combo package components"
  on public.combo_package_components
  for select
  to authenticated
  using (true);

grant select on public.combo_package_components to authenticated;

-- ---------------------------------------------------------------------
-- 3. Package availability
-- ---------------------------------------------------------------------
-- Same "available-to-sell" idea as get_available_to_sell (0030), applied
-- across every required stock component. Only REQUIRED components gate
-- the public available/out_of_stock/unavailable status; an optional
-- accessory running out doesn't hide the whole package from the catalogue
-- (it would still fail atomically at actual checkout if truly
-- unavailable at that moment -- see create_combo_order_with_reservations
-- below -- exactly like a regular product going out of stock between
-- browse and buy).

create function public.get_combo_package_availability(p_package_id uuid, p_branch_id text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_package public.combo_packages;
  v_branch_status text;
  v_component record;
begin
  select * into v_package from public.combo_packages where id = p_package_id;
  if not found or not v_package.is_active or not v_package.is_visible_on_website then
    return 'unavailable';
  end if;

  select status into v_branch_status from public.branches where id = p_branch_id;
  if not found or v_branch_status <> 'active' then
    return 'unavailable';
  end if;

  for v_component in
    select product_id, quantity
    from public.combo_package_components
    where combo_package_id = p_package_id and is_required = true and product_id is not null
  loop
    if public.get_available_to_sell(v_component.product_id, p_branch_id) < v_component.quantity then
      return 'out_of_stock';
    end if;
  end loop;

  return 'available';
end;
$$;

revoke all on function public.get_combo_package_availability(uuid, text) from public;
grant execute on function public.get_combo_package_availability(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Safe public package catalogue RPCs
-- ---------------------------------------------------------------------

create function public.get_website_combo_packages_by_branch(p_branch_id text)
returns table (
  id uuid,
  package_code text,
  name text,
  website_slug text,
  short_description text,
  full_description text,
  main_image_url text,
  gallery_image_urls jsonb,
  final_price numeric,
  system_capacity_text text,
  appliances_supported jsonb,
  installation_scope text,
  warranty_text text,
  inspection_required boolean,
  is_featured boolean,
  display_order integer,
  branch_id text,
  branch_name text,
  availability_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_branch_name text;
  v_branch_status text;
begin
  select b.name, b.status into v_branch_name, v_branch_status from public.branches b where b.id = p_branch_id;
  if not found then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;
  if v_branch_status <> 'active' then
    raise exception 'Branch is not active: %', p_branch_id;
  end if;

  return query
    select
      p.id, p.package_code, p.name, p.website_slug, p.short_description, p.full_description,
      p.main_image_url, p.gallery_image_urls, p.final_price, p.system_capacity_text,
      p.appliances_supported, p.installation_scope, p.warranty_text, p.inspection_required,
      p.is_featured, p.display_order, p_branch_id, v_branch_name,
      public.get_combo_package_availability(p.id, p_branch_id)
    from public.combo_packages p
    where p.is_active = true and p.is_visible_on_website = true
    order by p.display_order, p.name;
end;
$$;

revoke all on function public.get_website_combo_packages_by_branch(text) from public;
grant execute on function public.get_website_combo_packages_by_branch(text) to anon, authenticated;

-- Per-slug detail, including a safe "inclusions" list (name + quantity +
-- type only -- no product_id, no price) built from combo_package_components
-- server-side, so the browser never touches that table directly.
create function public.get_website_combo_package_by_slug(p_slug text, p_branch_id text)
returns table (
  id uuid,
  package_code text,
  name text,
  website_slug text,
  short_description text,
  full_description text,
  main_image_url text,
  gallery_image_urls jsonb,
  final_price numeric,
  system_capacity_text text,
  appliances_supported jsonb,
  installation_scope text,
  warranty_text text,
  inspection_required boolean,
  is_featured boolean,
  branch_id text,
  branch_name text,
  availability_status text,
  inclusions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_package public.combo_packages;
  v_branch_name text;
  v_branch_status text;
begin
  select b.name, b.status into v_branch_name, v_branch_status from public.branches b where b.id = p_branch_id;
  if not found then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;
  if v_branch_status <> 'active' then
    raise exception 'Branch is not active: %', p_branch_id;
  end if;

  select * into v_package
    from public.combo_packages
    where website_slug = p_slug and is_active = true and is_visible_on_website = true;

  if not found then
    return;
  end if;

  return query
    select
      v_package.id, v_package.package_code, v_package.name, v_package.website_slug,
      v_package.short_description, v_package.full_description, v_package.main_image_url,
      v_package.gallery_image_urls, v_package.final_price, v_package.system_capacity_text,
      v_package.appliances_supported, v_package.installation_scope, v_package.warranty_text,
      v_package.inspection_required, v_package.is_featured, p_branch_id, v_branch_name,
      public.get_combo_package_availability(v_package.id, p_branch_id),
      coalesce((
        select jsonb_agg(
          jsonb_build_object('displayName', c.display_name, 'quantity', c.quantity, 'componentType', c.component_type)
          order by c.display_order, c.display_name
        )
        from public.combo_package_components c
        where c.combo_package_id = v_package.id
      ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_website_combo_package_by_slug(text, text) from public;
grant execute on function public.get_website_combo_package_by_slug(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. BMS package management functions
-- ---------------------------------------------------------------------
-- Same shape as update_product_website_details (0028): one admin-checked
-- function per write, never a direct RLS-gated table write, so "only
-- Owner/Admin can create or edit package prices and components" is one
-- enforced choke point. p_components shape:
-- [{"product_id": "...", "quantity": 1, "component_type": "inverter",
--   "is_required": true, "display_name": "...", "display_order": 0}]
-- (product_id omitted/null for an installation_service line).

create function public.create_combo_package(
  p_package_code text,
  p_name text,
  p_website_slug text,
  p_short_description text,
  p_full_description text,
  p_main_image_url text,
  p_gallery_image_urls jsonb,
  p_final_price numeric,
  p_system_capacity_text text,
  p_capacity_rank integer,
  p_appliances_supported jsonb,
  p_installation_scope text,
  p_warranty_text text,
  p_inspection_required boolean,
  p_is_active boolean,
  p_is_visible_on_website boolean,
  p_is_featured boolean,
  p_display_order integer,
  p_components jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package_id uuid;
  v_component jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only Owner/Admin can create combo packages';
  end if;

  if p_final_price < 0 then
    raise exception 'Final price must be zero or greater';
  end if;
  if p_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;
  if jsonb_typeof(p_gallery_image_urls) is distinct from 'array' then
    raise exception 'Gallery images must be a JSON array';
  end if;
  if jsonb_typeof(p_appliances_supported) is distinct from 'array' then
    raise exception 'Appliances supported must be a JSON array';
  end if;
  if p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'A package must have at least one component';
  end if;

  insert into public.combo_packages (
    package_code, name, website_slug, short_description, full_description, main_image_url,
    gallery_image_urls, final_price, system_capacity_text, capacity_rank, appliances_supported,
    installation_scope, warranty_text, inspection_required, is_active, is_visible_on_website,
    is_featured, display_order, created_by, updated_by
  ) values (
    btrim(p_package_code), btrim(p_name), btrim(p_website_slug), nullif(btrim(p_short_description), ''),
    nullif(btrim(p_full_description), ''), nullif(btrim(p_main_image_url), ''), p_gallery_image_urls,
    p_final_price, nullif(btrim(p_system_capacity_text), ''), coalesce(p_capacity_rank, 0),
    p_appliances_supported, nullif(btrim(p_installation_scope), ''), nullif(btrim(p_warranty_text), ''),
    p_inspection_required, p_is_active, p_is_visible_on_website, p_is_featured, p_display_order,
    auth.uid(), auth.uid()
  )
  returning id into v_package_id;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    insert into public.combo_package_components (
      combo_package_id, product_id, quantity, component_type, is_required, display_name, display_order
    ) values (
      v_package_id,
      nullif(v_component ->> 'product_id', '')::uuid,
      (v_component ->> 'quantity')::integer,
      v_component ->> 'component_type',
      coalesce((v_component ->> 'is_required')::boolean, true),
      v_component ->> 'display_name',
      coalesce((v_component ->> 'display_order')::integer, 0)
    );
  end loop;

  return v_package_id;
end;
$$;

revoke all on function public.create_combo_package(
  text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) from public;
grant execute on function public.create_combo_package(
  text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) to authenticated;

-- Same field list as create, plus p_id -- replaces every component row
-- (delete + reinsert) rather than diffing, since components aren't
-- referenced by id from anywhere else (a purchase snapshots by value into
-- combo_order_details, not by combo_package_components.id), so this can
-- never corrupt a past order.
create function public.update_combo_package(
  p_id uuid,
  p_package_code text,
  p_name text,
  p_website_slug text,
  p_short_description text,
  p_full_description text,
  p_main_image_url text,
  p_gallery_image_urls jsonb,
  p_final_price numeric,
  p_system_capacity_text text,
  p_capacity_rank integer,
  p_appliances_supported jsonb,
  p_installation_scope text,
  p_warranty_text text,
  p_inspection_required boolean,
  p_is_active boolean,
  p_is_visible_on_website boolean,
  p_is_featured boolean,
  p_display_order integer,
  p_components jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_component jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only Owner/Admin can edit combo packages';
  end if;

  if p_final_price < 0 then
    raise exception 'Final price must be zero or greater';
  end if;
  if jsonb_typeof(p_gallery_image_urls) is distinct from 'array' then
    raise exception 'Gallery images must be a JSON array';
  end if;
  if jsonb_typeof(p_appliances_supported) is distinct from 'array' then
    raise exception 'Appliances supported must be a JSON array';
  end if;
  if p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'A package must have at least one component';
  end if;

  update public.combo_packages
    set package_code = btrim(p_package_code),
        name = btrim(p_name),
        website_slug = btrim(p_website_slug),
        short_description = nullif(btrim(p_short_description), ''),
        full_description = nullif(btrim(p_full_description), ''),
        main_image_url = nullif(btrim(p_main_image_url), ''),
        gallery_image_urls = p_gallery_image_urls,
        final_price = p_final_price,
        system_capacity_text = nullif(btrim(p_system_capacity_text), ''),
        capacity_rank = coalesce(p_capacity_rank, 0),
        appliances_supported = p_appliances_supported,
        installation_scope = nullif(btrim(p_installation_scope), ''),
        warranty_text = nullif(btrim(p_warranty_text), ''),
        inspection_required = p_inspection_required,
        is_active = p_is_active,
        is_visible_on_website = p_is_visible_on_website,
        is_featured = p_is_featured,
        display_order = p_display_order,
        updated_by = auth.uid()
    where id = p_id;

  if not found then
    raise exception 'Package not found';
  end if;

  delete from public.combo_package_components where combo_package_id = p_id;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    insert into public.combo_package_components (
      combo_package_id, product_id, quantity, component_type, is_required, display_name, display_order
    ) values (
      p_id,
      nullif(v_component ->> 'product_id', '')::uuid,
      (v_component ->> 'quantity')::integer,
      v_component ->> 'component_type',
      coalesce((v_component ->> 'is_required')::boolean, true),
      v_component ->> 'display_name',
      coalesce((v_component ->> 'display_order')::integer, 0)
    );
  end loop;
end;
$$;

revoke all on function public.update_combo_package(
  uuid, text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) from public;
grant execute on function public.update_combo_package(
  uuid, text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) to authenticated;

-- Lightweight status-only toggle for the BMS list view (activate/
-- deactivate, show/hide, feature, reorder) without opening the full edit
-- form. Still admin-only -- see this migration's header comment on why
-- Manager status-editing wasn't built in Stage 6.
create function public.set_combo_package_status(
  p_id uuid,
  p_is_active boolean,
  p_is_visible_on_website boolean,
  p_is_featured boolean,
  p_display_order integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Owner/Admin can change package status';
  end if;

  update public.combo_packages
    set is_active = p_is_active,
        is_visible_on_website = p_is_visible_on_website,
        is_featured = p_is_featured,
        display_order = coalesce(p_display_order, display_order),
        updated_by = auth.uid()
    where id = p_id;

  if not found then
    raise exception 'Package not found';
  end if;
end;
$$;

revoke all on function public.set_combo_package_status(uuid, boolean, boolean, boolean, integer) from public;
grant execute on function public.set_combo_package_status(uuid, boolean, boolean, boolean, integer) to authenticated;

-- Owner-only profit view: joins combo_packages to their stock components'
-- real cost_price, computed on the fly rather than stored, so editing a
-- product's cost immediately reflects in package profit with nothing to
-- keep in sync. Not a view grantable to anon/authenticated broadly --
-- selecting from public.products already requires an authenticated
-- session (0003_products.sql), and this additionally gates on is_admin()
-- inside a function rather than a bare view, so a non-admin calling it
-- directly still gets nothing.
create function public.get_combo_package_profit(p_package_id uuid)
returns table (final_price numeric, component_cost numeric, estimated_profit numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_final_price numeric;
  v_cost numeric;
begin
  if not public.is_admin() then
    raise exception 'Only Owner/Admin can view package profit';
  end if;

  select final_price into v_final_price from public.combo_packages where id = p_package_id;
  if not found then
    raise exception 'Package not found';
  end if;

  select coalesce(sum(p.cost_price * c.quantity), 0) into v_cost
    from public.combo_package_components c
    join public.products p on p.id = c.product_id
    where c.combo_package_id = p_package_id;

  return query select v_final_price, v_cost, v_final_price - v_cost;
end;
$$;

revoke all on function public.get_combo_package_profit(uuid) from public;
grant execute on function public.get_combo_package_profit(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. combo-package-images Storage bucket
-- ---------------------------------------------------------------------
-- Same shape as product-images (0028) and branding (0020): public read,
-- Owner/Admin-only write. The app is responsible for generating a unique
-- filename per upload (see STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md) and
-- storing only the resulting URL/path on combo_packages -- never base64.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'combo-package-images',
  'combo-package-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read combo package images"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'combo-package-images');

create policy "Only admins can upload combo package images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'combo-package-images' and public.is_admin());

create policy "Only admins can update combo package images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'combo-package-images' and public.is_admin())
  with check (bucket_id = 'combo-package-images' and public.is_admin());

create policy "Only admins can delete combo package images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'combo-package-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 7. orders / order_items: Stage 6 extensions
-- ---------------------------------------------------------------------
-- Widen the existing check constraints rather than inventing a parallel
-- table: a combo package purchase is still "an order", just with
-- order_type = 'combo_package' and one snapshot row in
-- combo_order_details (section 9) instead of relying on order_items
-- alone for its price. payment_method gains 'store_credit' for the
-- "fully covered by store credit, no Paystack call at all" case (section
-- 28). upgrade_from_order_id links a package-upgrade replacement order
-- back to the original unsuitable-package order (section 14/29) -- see
-- finalize_package_upgrade_side_effects further down.
--
-- Constraint names below are Postgres's default auto-generated names for
-- an unnamed inline column CHECK (`<table>_<column>_check`), which is
-- what 0030_orders_and_payments.sql produced since it never named them
-- explicitly.

alter table public.orders drop constraint orders_order_type_check;
alter table public.orders add constraint orders_order_type_check
  check (order_type in ('online_payment', 'whatsapp_request', 'combo_package'));

alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('paystack', 'whatsapp', 'store_credit', 'package_upgrade_credit'));

alter table public.orders add column if not exists upgrade_from_order_id uuid references public.orders (id);

comment on column public.orders.upgrade_from_order_id is 'Set only on a package-upgrade replacement order (section 29): the original order whose paid amount is being applied toward this higher-capacity package. Null for every ordinary order.';

-- Stage 5 left store_credit_used as "always 0, schema placeholder" --
-- this is that future stage. Drop the now-inaccurate comment.
comment on column public.orders.store_credit_used is 'Amount of the customer''s store credit balance applied to this order. Not debited from store_credit_accounts until finalize_successful_online_order actually marks the order paid (see get_available_store_credit below) -- a pending/processing order only *holds* this amount, the same way an active stock_reservation holds inventory without yet deducting it.';

-- ---------------------------------------------------------------------
-- 8. combo_order_details (purchase-time snapshot)
-- ---------------------------------------------------------------------

create table public.combo_order_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  combo_package_id uuid not null references public.combo_packages (id),
  package_code text not null,
  package_name text not null,
  package_slug text not null,
  final_price numeric(14, 2) not null check (final_price >= 0),
  system_capacity_text text,
  appliances_supported jsonb not null default '[]'::jsonb,
  installation_scope text,
  warranty_text text,
  inspection_required boolean not null default true,
  components jsonb not null default '[]'::jsonb,
  branch_id text not null references public.branches (id),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

comment on table public.combo_order_details is 'Point-in-time snapshot of the package a customer bought, so a later edit to combo_packages/combo_package_components never changes what a past order shows. `components` is a plain jsonb array of {name, sku, quantity, componentType} -- no price, no product_id.';
comment on column public.combo_order_details.quantity is 'Always 1 in Stage 6 (see "one package per order" scope note in STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md) -- kept as a column rather than assumed, so a future stage can raise the limit without a schema change.';

alter table public.combo_order_details enable row level security;

create policy "Customers can read their own combo order details"
  on public.combo_order_details
  for select
  to authenticated
  using (exists (select 1 from public.orders o where o.id = combo_order_details.order_id and o.customer_id = auth.uid()));

create policy "Admins can read all combo order details"
  on public.combo_order_details
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's combo order details"
  on public.combo_order_details
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and branch_id = combo_order_details.branch_id));

grant select on public.combo_order_details to authenticated;

-- ---------------------------------------------------------------------
-- 9. Store credit accounts & ledger
-- ---------------------------------------------------------------------

create table public.store_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customer_profiles (id),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_credit_accounts is 'One row per customer, created lazily on first credit issuance. Non-transferable and permanent -- tied to customer_id for its whole life, never reassigned. Balance is only ever changed by credit_store_credit_account/debit_store_credit_account below, both internal (no direct grant to authenticated), so a customer can read but never write their own balance.';

create trigger set_store_credit_accounts_updated_at
  before update on public.store_credit_accounts
  for each row execute procedure public.set_updated_at();

alter table public.store_credit_accounts enable row level security;

create policy "Customers can read their own store credit balance"
  on public.store_credit_accounts
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all store credit accounts"
  on public.store_credit_accounts
  for select
  to authenticated
  using (public.is_admin());

grant select on public.store_credit_accounts to authenticated;

create table public.store_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id),
  store_credit_account_id uuid not null references public.store_credit_accounts (id),
  order_id uuid references public.orders (id),
  refund_request_id uuid,
  transaction_type text not null check (transaction_type in (
    'credit', 'debit', 'adjustment', 'refund_conversion', 'order_payment', 'reversal'
  )),
  amount numeric(14, 2) not null check (amount > 0),
  balance_before numeric(14, 2) not null check (balance_before >= 0),
  balance_after numeric(14, 2) not null check (balance_after >= 0),
  description text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.store_credit_ledger is 'Append-only. No update/delete grant to anyone, including admins -- a mistake is corrected with a new "reversal" row, never by editing history (same append-only philosophy as stock_reservations).';

create index store_credit_ledger_customer_id_idx on public.store_credit_ledger (customer_id);
create index store_credit_ledger_account_id_idx on public.store_credit_ledger (store_credit_account_id);

alter table public.store_credit_ledger enable row level security;

create policy "Customers can read their own store credit ledger"
  on public.store_credit_ledger
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all store credit ledgers"
  on public.store_credit_ledger
  for select
  to authenticated
  using (public.is_admin());

grant select on public.store_credit_ledger to authenticated;
-- Deliberately no insert/update/delete grant to authenticated/anon at
-- all -- every ledger row is written by credit_store_credit_account/
-- debit_store_credit_account, both SECURITY DEFINER and called only from
-- other SECURITY DEFINER functions in this migration (a nested call from
-- inside a SECURITY DEFINER function runs as that function's owner, so it
-- succeeds with no grant needed on the inner function -- see
-- STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md).

-- Internal only: idempotent-by-construction (it just appends), so callers
-- are responsible for not calling it twice for the same event -- every
-- caller in this migration guards that with an order/refund-request
-- status check first.
create function public.credit_store_credit_account(
  p_customer_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_order_id uuid,
  p_refund_request_id uuid,
  p_description text,
  p_created_by uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  insert into public.store_credit_accounts (customer_id) values (p_customer_id)
    on conflict (customer_id) do nothing;

  select id, balance into v_account_id, v_balance_before
    from public.store_credit_accounts
    where customer_id = p_customer_id
    for update;

  v_balance_after := v_balance_before + p_amount;

  update public.store_credit_accounts set balance = v_balance_after where id = v_account_id;

  insert into public.store_credit_ledger (
    customer_id, store_credit_account_id, order_id, refund_request_id, transaction_type,
    amount, balance_before, balance_after, description, created_by
  ) values (
    p_customer_id, v_account_id, p_order_id, p_refund_request_id, p_transaction_type,
    p_amount, v_balance_before, v_balance_after, p_description, p_created_by
  );

  return v_balance_after;
end;
$$;

revoke all on function public.credit_store_credit_account(uuid, numeric, text, uuid, uuid, text, uuid) from public, anon, authenticated;

-- Internal only. Raises if the account can't cover the debit -- callers
-- must have already clamped the requested amount against
-- get_available_store_credit() before this point, so hitting this
-- exception means a genuine race (two finalisations for the same
-- customer landing at once), not normal usage.
create function public.debit_store_credit_account(
  p_customer_id uuid,
  p_amount numeric,
  p_transaction_type text,
  p_order_id uuid,
  p_refund_request_id uuid,
  p_description text,
  p_created_by uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_balance_before numeric;
  v_balance_after numeric;
begin
  if p_amount <= 0 then
    raise exception 'Debit amount must be greater than zero';
  end if;

  select id, balance into v_account_id, v_balance_before
    from public.store_credit_accounts
    where customer_id = p_customer_id
    for update;

  if not found or v_balance_before < p_amount then
    raise exception 'Insufficient store credit balance';
  end if;

  v_balance_after := v_balance_before - p_amount;

  update public.store_credit_accounts set balance = v_balance_after where id = v_account_id;

  insert into public.store_credit_ledger (
    customer_id, store_credit_account_id, order_id, refund_request_id, transaction_type,
    amount, balance_before, balance_after, description, created_by
  ) values (
    p_customer_id, v_account_id, p_order_id, p_refund_request_id, p_transaction_type,
    p_amount, v_balance_before, v_balance_after, p_description, p_created_by
  );

  return v_balance_after;
end;
$$;

revoke all on function public.debit_store_credit_account(uuid, numeric, text, uuid, uuid, text, uuid) from public, anon, authenticated;

-- Public (customer-facing) helper: balance minus what's currently *held*
-- by the customer's own not-yet-finalised orders -- the same
-- physical-minus-active-reservations shape get_available_to_sell uses for
-- stock, applied to money instead. Nothing is written here; it's a pure
-- read used both by the website (to show/clamp how much credit a
-- customer can apply at checkout) and by the order-creation functions
-- below (to clamp what they'll actually accept).
create function public.get_available_store_credit(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    coalesce((select balance from public.store_credit_accounts where customer_id = p_customer_id), 0)
    - coalesce((
        select sum(store_credit_used) from public.orders
        where customer_id = p_customer_id
          and store_credit_used > 0
          and status in ('pending_payment', 'payment_processing')
      ), 0)
  );
$$;

revoke all on function public.get_available_store_credit(uuid) from public;
grant execute on function public.get_available_store_credit(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. create_online_order_with_reservation: add store credit (section 26)
-- ---------------------------------------------------------------------
-- Adds a new trailing parameter (with a default) to 0030's version, but a
-- new parameter still means a new Postgres signature -- `create or
-- replace` would otherwise leave the old 3-argument function sitting
-- alongside this one (two overloads), which makes a 3-argument call from
-- code that hasn't been redeployed yet ambiguous. Drop the old signature
-- explicitly first; this only removes a function 0030 created, not any
-- of that migration's file content.
drop function if exists public.create_online_order_with_reservation(text, jsonb, text);

-- Everything through "Pass 2" is unchanged from 0030_orders_and_payments.sql;
-- the only new logic is the store-credit clamp right before the order
-- insert, and the "fully covered by credit, finalise immediately" branch
-- at the end (section 28).

create function public.create_online_order_with_reservation(
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
  v_branch_status text;
  v_expiry_minutes integer;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products;
  v_physical_stock integer;
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

    select quantity into v_physical_stock
      from public.product_stock
      where product_id = v_product_id and branch_id = p_branch_id
      for update;
    v_physical_stock := coalesce(v_physical_stock, 0);

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_product_id and branch_id = p_branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_quantity then
      raise exception '% is no longer available in the requested quantity at this branch', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.website_price * v_quantity);
  end loop;

  -- Store credit clamp (section 26/27): never more than requested, never
  -- more than what's actually available right now (balance minus what
  -- the customer's other in-flight orders are already holding), never
  -- more than the order itself costs.
  v_available_credit := public.get_available_store_credit(v_customer_id);
  v_credit_to_use := least(greatest(coalesce(p_store_credit_requested, 0), 0), v_available_credit, v_subtotal);
  v_amount_payable := v_subtotal - v_credit_to_use;
  v_payment_method := case when v_amount_payable = 0 then 'store_credit' else 'paystack' end;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_reference := v_order_number;

  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, store_credit_used, amount_payable, customer_name, customer_email, customer_phone,
    paystack_reference, reservation_expires_at, client_idempotency_key
  ) values (
    v_order_number, v_customer_id, p_branch_id, 'online_payment', 'pending_payment', 'unpaid', v_payment_method,
    v_subtotal, v_credit_to_use, v_amount_payable, v_customer.full_name, v_customer.email, v_customer.phone,
    v_reference, v_expires_at, p_idempotency_key
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_product from public.products where id = v_product_id;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug,
      product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug,
      v_product.product_image_url, v_product.website_price, v_quantity,
      v_product.website_price * v_quantity
    )
    returning id into v_order_item_id;

    insert into public.stock_reservations (
      order_id, order_item_id, product_id, branch_id, quantity, status, expires_at
    ) values (
      v_order.id, v_order_item_id, v_product.id, p_branch_id, v_quantity, 'active', v_expires_at
    );
  end loop;

  -- Section 28: fully covered by store credit -- finalise right now,
  -- inside this same transaction, instead of ever calling Paystack.
  if v_amount_payable = 0 then
    perform public.finalize_successful_online_order(v_reference, 0, 'STORE_CREDIT_ONLY');
    select * into v_order from public.orders where id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
end;
$$;

revoke all on function public.create_online_order_with_reservation(text, jsonb, text, numeric) from public;
revoke all on function public.create_online_order_with_reservation(text, jsonb, text, numeric) from anon;
grant execute on function public.create_online_order_with_reservation(text, jsonb, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 11. create_combo_order_with_reservations
-- ---------------------------------------------------------------------
-- One package per order in this stage (see "FIXED PACKAGE RULE" / section
-- 9 of the brief, which explicitly allows defaulting to 1 -- the
-- combo_order_details.quantity column exists for a future stage to raise
-- this without a schema change, but nothing here multiplies by anything
-- other than 1 yet). Reuses the exact same lock-then-check-then-reserve
-- shape as create_online_order_with_reservation, over
-- combo_package_components instead of a client-supplied item list --
-- nothing about the package's price or contents is ever taken from the
-- browser, only which package + branch was chosen.

create function public.create_combo_order_with_reservations(
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
    select c.product_id, c.quantity
    from public.combo_package_components c
    where c.combo_package_id = p_package_id and c.product_id is not null
    order by c.product_id
  loop
    select quantity into v_physical_stock
      from public.product_stock
      where product_id = v_component.product_id and branch_id = p_branch_id
      for update;
    v_physical_stock := coalesce(v_physical_stock, 0);

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_component.product_id and branch_id = p_branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_component.quantity then
      raise exception 'This package is no longer fully available at this branch (one or more components are out of stock)';
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

revoke all on function public.create_combo_order_with_reservations(uuid, text, text, numeric) from public;
revoke all on function public.create_combo_order_with_reservations(uuid, text, text, numeric) from anon;
grant execute on function public.create_combo_order_with_reservations(uuid, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 12. installation_jobs
-- ---------------------------------------------------------------------
-- branch_id is `text` here, not `uuid` -- same deviation from the brief's
-- suggested schema as orders.branch_id/stock_reservations.branch_id
-- (public.branches.id really is text; see 0001_branches.sql).

create table public.installation_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  combo_package_id uuid not null references public.combo_packages (id),
  customer_id uuid not null references public.customer_profiles (id),
  branch_id text not null references public.branches (id),
  status text not null default 'site_inspection_required' check (status in (
    'site_inspection_required', 'inspection_scheduled', 'inspection_completed', 'package_suitable',
    'package_unsuitable', 'awaiting_customer_decision', 'installation_scheduled',
    'installation_in_progress', 'installation_completed', 'cancelled', 'refunded'
  )),
  inspection_required boolean not null default true,
  inspection_scheduled_at timestamptz,
  inspection_completed_at timestamptz,
  inspection_result text check (inspection_result is null or inspection_result in ('suitable', 'unsuitable')),
  inspection_notes text,
  recommended_package_id uuid references public.combo_packages (id),
  installation_scheduled_at timestamptz,
  installation_started_at timestamptz,
  installation_completed_at timestamptz,
  assigned_staff_id uuid references public.profiles (id),
  customer_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.installation_jobs is 'One row per combo package order, tracking the site-inspection -> installation lifecycle. Created by finalize_successful_online_order the moment a combo_package order is paid; never created or written to directly by the website or by customers -- every transition below is a validated SECURITY DEFINER function.';

create trigger set_installation_jobs_updated_at
  before update on public.installation_jobs
  for each row execute procedure public.set_updated_at();

create index installation_jobs_branch_id_idx on public.installation_jobs (branch_id);
create index installation_jobs_status_idx on public.installation_jobs (status);

alter table public.installation_jobs enable row level security;

create policy "Customers can read their own installation jobs"
  on public.installation_jobs
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all installation jobs"
  on public.installation_jobs
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's installation jobs"
  on public.installation_jobs
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and branch_id = installation_jobs.branch_id));

grant select on public.installation_jobs to authenticated;
-- No insert/update/delete grant to anyone -- see functions below.

-- ---------------------------------------------------------------------
-- 13. refund_requests
-- ---------------------------------------------------------------------

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  customer_id uuid not null references public.customer_profiles (id),
  request_type text not null check (request_type in (
    'full_refund', 'store_credit_conversion', 'paid_order_cancellation', 'package_unsuitable'
  )),
  reason text,
  requested_amount numeric(14, 2) not null check (requested_amount >= 0),
  status text not null default 'pending' check (status in (
    'pending', 'manager_approved', 'owner_approved', 'rejected', 'processing', 'completed', 'failed'
  )),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  rejection_reason text,
  paystack_refund_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.refund_requests is 'Covers three customer-money-back paths (full_refund, store_credit_conversion, paid_order_cancellation) plus one transitional marker (package_unsuitable, auto-created by record_inspection_result -- see section 16 below -- and rewritten to one of the other three once the customer picks). A customer never approves their own request; see manager_approve_refund_request/owner_approve_refund_request.';

create trigger set_refund_requests_updated_at
  before update on public.refund_requests
  for each row execute procedure public.set_updated_at();

create index refund_requests_order_id_idx on public.refund_requests (order_id);
create index refund_requests_status_idx on public.refund_requests (status);

alter table public.refund_requests enable row level security;

create policy "Customers can read their own refund requests"
  on public.refund_requests
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all refund requests"
  on public.refund_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's refund requests"
  on public.refund_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.profiles p on p.id = auth.uid()
      where o.id = refund_requests.order_id and p.branch_id = o.branch_id
    )
  );

grant select on public.refund_requests to authenticated;
-- No insert/update/delete grant to anyone -- see functions below. In
-- particular there is no "customer can insert their own refund request"
-- policy: every refund_requests row starts life as a staff-created
-- package_unsuitable marker (record_inspection_result) or a customer
-- function that still runs its own ownership/state checks
-- (request_paid_order_cancellation) rather than a bare RLS insert check.

-- ---------------------------------------------------------------------
-- 14. finalize_successful_online_order: Stage 6 extensions
-- ---------------------------------------------------------------------
-- Same 3-argument signature as 0030's version, so `create or replace`
-- carries over its existing "service_role only" grant unchanged -- no
-- grant needs restating. It is still never called directly by a customer
-- session: the webhook and /api/payments/paystack/verify routes call it
-- with the service_role client, and create_online_order_with_reservation/
-- create_combo_order_with_reservations above call it as a plain nested
-- function call for the "fully covered by store credit" case -- which
-- works with no grant to `authenticated` at all, because a nested call
-- made from inside a SECURITY DEFINER function runs as that function's
-- *owner*, not as the original caller, and an owner always implicitly has
-- EXECUTE on their own functions regardless of what's been revoked from
-- other roles.
--
-- Additions beyond 0030's version: debit any held store credit atomically
-- alongside marking the order paid (section 26-28); open the
-- installation_jobs workflow for a combo_package order (section 12); and,
-- if this order is itself a package-upgrade replacement order, run its
-- linked side effects (section 17). Everything through the stock
-- deduction loop is unchanged.

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

  insert into public.notifications (type, message)
  values (
    'success',
    'New paid website order ' || v_order.order_number || ' at ' || coalesce(v_branch_name, v_order.branch_id)
      || ' (NGN ' || v_order.amount_paid || ').'
  );

  if v_order.order_type = 'combo_package' then
    select * into v_combo_details from public.combo_order_details where order_id = v_order.id;

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

-- ---------------------------------------------------------------------
-- 15. Site inspection / installation workflow (section 14)
-- ---------------------------------------------------------------------
-- Every function here is gated by can_act_on_installation(branch_id):
-- the Owner (any branch), that branch's Manager, or a salesperson the
-- Owner has opted in via profiles.can_manage_installations. "Contact the
-- customer" from the brief needs no function -- staff already have the
-- order's customer_phone/customer_email via the existing orders read
-- policy.

create function public.schedule_inspection(
  p_installation_job_id uuid,
  p_scheduled_at timestamptz,
  p_customer_address text default null
)
returns public.installation_jobs
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
begin
  select * into v_job from public.installation_jobs where id = p_installation_job_id for update;
  if not found then
    raise exception 'Installation job not found';
  end if;

  if not public.can_act_on_installation(v_job.branch_id) then
    raise exception 'You are not permitted to manage installation jobs at this branch';
  end if;

  if v_job.status not in ('site_inspection_required', 'inspection_scheduled') then
    raise exception 'This job is not awaiting inspection scheduling';
  end if;

  update public.installation_jobs
    set status = 'inspection_scheduled',
        inspection_scheduled_at = p_scheduled_at,
        customer_address = coalesce(nullif(btrim(p_customer_address), ''), customer_address)
    where id = v_job.id
    returning * into v_job;

  insert into public.notifications (type, message)
  values ('info', 'Site inspection scheduled for order ' ||
    (select order_number from public.orders where id = v_job.order_id) || '.');

  return v_job;
end;
$$;

revoke all on function public.schedule_inspection(uuid, timestamptz, text) from public;
grant execute on function public.schedule_inspection(uuid, timestamptz, text) to authenticated;

-- Section 15/16: 'suitable' keeps the original package and moves straight
-- to installation scheduling. 'unsuitable' requires notes, accepts only a
-- HIGHER-capacity recommendation (capacity_rank strictly greater than the
-- purchased package's), and moves the job to awaiting_customer_decision
-- -- staff never refund or swap the package themselves from here (section
-- 16: "Do not automatically issue a refund. Do not automatically change
-- the package"). A pending refund_requests row (type package_unsuitable)
-- is created here too, if one doesn't already exist for this order, so
-- there is always something for a Manager/Owner to eventually act on once
-- the customer responds.
create function public.record_inspection_result(
  p_installation_job_id uuid,
  p_result text,
  p_notes text,
  p_recommended_package_id uuid default null
)
returns public.installation_jobs
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
  v_order public.orders;
  v_original_rank integer;
  v_recommended public.combo_packages;
begin
  if p_result not in ('suitable', 'unsuitable') then
    raise exception 'Invalid inspection result: %', p_result;
  end if;

  select * into v_job from public.installation_jobs where id = p_installation_job_id for update;
  if not found then
    raise exception 'Installation job not found';
  end if;

  if not public.can_act_on_installation(v_job.branch_id) then
    raise exception 'You are not permitted to manage installation jobs at this branch';
  end if;

  if v_job.status not in ('site_inspection_required', 'inspection_scheduled') then
    raise exception 'This job is not awaiting an inspection result';
  end if;

  select * into v_order from public.orders where id = v_job.order_id;

  if p_result = 'suitable' then
    update public.installation_jobs
      set status = 'package_suitable',
          inspection_result = 'suitable',
          inspection_notes = nullif(btrim(p_notes), ''),
          inspection_completed_at = now()
      where id = v_job.id
      returning * into v_job;

    insert into public.notifications (type, message)
    values ('success', 'Package confirmed suitable for order ' || v_order.order_number || ' -- ready to schedule installation.');
  else
    if nullif(btrim(p_notes), '') is null then
      raise exception 'Inspection notes are required when marking a package unsuitable';
    end if;

    if p_recommended_package_id is not null then
      select capacity_rank into v_original_rank from public.combo_packages where id = v_job.combo_package_id;
      select * into v_recommended from public.combo_packages where id = p_recommended_package_id;

      if not found or not v_recommended.is_active or not v_recommended.is_visible_on_website then
        raise exception 'Recommended package is not available';
      end if;
      if v_recommended.capacity_rank <= v_original_rank then
        raise exception 'A recommended package must have a higher capacity than the original';
      end if;
    end if;

    update public.installation_jobs
      set status = 'awaiting_customer_decision',
          inspection_result = 'unsuitable',
          inspection_notes = p_notes,
          inspection_completed_at = now(),
          recommended_package_id = p_recommended_package_id
      where id = v_job.id
      returning * into v_job;

    insert into public.refund_requests (order_id, customer_id, request_type, reason, requested_amount, status)
    select v_order.id, v_order.customer_id, 'package_unsuitable', p_notes, v_order.amount_paid, 'pending'
    where not exists (
      select 1 from public.refund_requests
      where order_id = v_order.id and status not in ('rejected', 'completed', 'failed')
    );

    insert into public.notifications (type, message)
    values ('warning', 'Package marked unsuitable for order ' || v_order.order_number || ' -- awaiting the customer''s decision.');
  end if;

  return v_job;
end;
$$;

revoke all on function public.record_inspection_result(uuid, text, text, uuid) from public;
grant execute on function public.record_inspection_result(uuid, text, text, uuid) to authenticated;

create function public.schedule_installation(
  p_installation_job_id uuid,
  p_scheduled_at timestamptz,
  p_assigned_staff_id uuid default null
)
returns public.installation_jobs
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
begin
  select * into v_job from public.installation_jobs where id = p_installation_job_id for update;
  if not found then
    raise exception 'Installation job not found';
  end if;

  if not public.can_act_on_installation(v_job.branch_id) then
    raise exception 'You are not permitted to manage installation jobs at this branch';
  end if;

  if v_job.status <> 'package_suitable' then
    raise exception 'Installation can only be scheduled once the package has been confirmed suitable';
  end if;

  update public.installation_jobs
    set status = 'installation_scheduled',
        installation_scheduled_at = p_scheduled_at,
        assigned_staff_id = coalesce(p_assigned_staff_id, assigned_staff_id)
    where id = v_job.id
    returning * into v_job;

  insert into public.notifications (type, message)
  values ('info', 'Installation scheduled for order ' ||
    (select order_number from public.orders where id = v_job.order_id) || '.');

  return v_job;
end;
$$;

revoke all on function public.schedule_installation(uuid, timestamptz, uuid) from public;
grant execute on function public.schedule_installation(uuid, timestamptz, uuid) to authenticated;

create function public.start_installation(p_installation_job_id uuid)
returns public.installation_jobs
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
begin
  select * into v_job from public.installation_jobs where id = p_installation_job_id for update;
  if not found then
    raise exception 'Installation job not found';
  end if;

  if not public.can_act_on_installation(v_job.branch_id) then
    raise exception 'You are not permitted to manage installation jobs at this branch';
  end if;

  if v_job.status <> 'installation_scheduled' then
    raise exception 'Installation has not been scheduled yet';
  end if;

  update public.installation_jobs
    set status = 'installation_in_progress', installation_started_at = now()
    where id = v_job.id
    returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.start_installation(uuid) from public;
grant execute on function public.start_installation(uuid) to authenticated;

create function public.complete_installation(p_installation_job_id uuid)
returns public.installation_jobs
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
  v_order public.orders;
begin
  select * into v_job from public.installation_jobs where id = p_installation_job_id for update;
  if not found then
    raise exception 'Installation job not found';
  end if;

  if not public.can_act_on_installation(v_job.branch_id) then
    raise exception 'You are not permitted to manage installation jobs at this branch';
  end if;

  if v_job.status <> 'installation_in_progress' then
    raise exception 'Installation is not in progress';
  end if;

  update public.installation_jobs
    set status = 'installation_completed', installation_completed_at = now()
    where id = v_job.id
    returning * into v_job;

  update public.orders set status = 'completed' where id = v_job.order_id and status = 'paid'
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('success', 'Installation completed for order ' || coalesce(v_order.order_number,
    (select order_number from public.orders where id = v_job.order_id)) || '.');

  return v_job;
end;
$$;

revoke all on function public.complete_installation(uuid) from public;
grant execute on function public.complete_installation(uuid) to authenticated;

revoke all on function public.finalize_successful_online_order(text, numeric, text) from public;
revoke all on function public.finalize_successful_online_order(text, numeric, text) from anon;
revoke all on function public.finalize_successful_online_order(text, numeric, text) from authenticated;
grant execute on function public.finalize_successful_online_order(text, numeric, text) to service_role;

-- ---------------------------------------------------------------------
-- 16. Stock restoration & package upgrade (sections 17, 22, 29)
-- ---------------------------------------------------------------------

alter table public.orders add column if not exists stock_restored boolean not null default false;

comment on column public.orders.stock_restored is 'Idempotency guard for restore_order_stock() -- flips to true the first (and only) time this order''s fulfilled reservations are restored to stock, whether that happens via a refund/cancellation or a package upgrade. Generic across order types (not just combo_package) so a refunded ordinary product order restores correctly too.';

-- Internal-only (called from owner_approve_refund_request/
-- convert_refund_to_store_credit and finalize_package_upgrade_side_effects,
-- never granted directly). Restores every STOCK item this order actually
-- had deducted (fulfilled reservations only -- an order_item with no
-- fulfilled reservation never had stock taken from it) back to its
-- branch, and records it as an ordinary 'in' stock movement. Works for
-- any order type: a combo package's stock components and a plain
-- product order's items both leave the same stock_reservations trail, so
-- this needs no combo-specific logic. Never touches installation_service
-- lines, which never had a stock_reservations row to begin with (section
-- 22: "do not restore non-stock installation service lines").
create function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_reservation record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.stock_restored then
    return;
  end if;

  for v_reservation in
    select * from public.stock_reservations where order_id = p_order_id and status = 'fulfilled' order by product_id
  loop
    update public.product_stock
      set quantity = quantity + v_reservation.quantity
      where product_id = v_reservation.product_id and branch_id = v_reservation.branch_id;

    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (
      v_reservation.product_id, v_reservation.branch_id, 'in', v_reservation.quantity,
      'Stock restored from cancelled/refunded order ' || v_order.order_number, null
    );
  end loop;

  update public.orders set stock_restored = true where id = p_order_id;
end;
$$;

revoke all on function public.restore_order_stock(uuid) from public, anon, authenticated;

-- Runs as part of finalize_successful_online_order, right after a
-- package-upgrade replacement order (orders.upgrade_from_order_id is not
-- null) has just been marked paid and given its own fresh
-- installation_job. Restores the ORIGINAL package's stock (section 29:
-- "restore original package components where appropriate" -- the
-- customer is no longer keeping the unsuitable package, so its
-- components go back to that branch's shelf) and closes out the original
-- order/job as superseded. Payment history on the original order is left
-- untouched (payment_status stays 'successful') -- nothing was refunded,
-- its value was applied toward the new order instead.
create function public.finalize_package_upgrade_side_effects(p_new_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_order public.orders;
  v_old_order public.orders;
begin
  select * into v_new_order from public.orders where id = p_new_order_id;
  if v_new_order.upgrade_from_order_id is null then
    return;
  end if;

  select * into v_old_order from public.orders where id = v_new_order.upgrade_from_order_id for update;

  perform public.restore_order_stock(v_old_order.id);

  if v_old_order.status <> 'cancelled' then
    update public.orders
      set status = 'cancelled',
          cancelled_at = now(),
          cancellation_reason = 'Superseded by package upgrade to order ' || v_new_order.order_number
      where id = v_old_order.id;
  end if;

  update public.installation_jobs
    set status = 'cancelled'
    where order_id = v_old_order.id and status not in ('installation_completed', 'cancelled', 'refunded');

  insert into public.notifications (type, message)
  values ('info', 'Order ' || v_old_order.order_number || ' was upgraded to a higher-capacity package via order ' || v_new_order.order_number || '.');
end;
$$;

revoke all on function public.finalize_package_upgrade_side_effects(uuid) from public, anon, authenticated;

-- Customer-facing: accepts the SPECIFIC package staff recommended (never
-- an arbitrary one the customer picks) and either completes immediately
-- (recommended package costs no more than what was already paid -- "do
-- not allow downgrade cash-out" means the difference floors at zero, it
-- never goes negative/refundable) or creates a new order for the
-- difference through the normal Paystack flow.
create function public.accept_package_upgrade(
  p_installation_job_id uuid,
  p_idempotency_key text default null
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
  v_job public.installation_jobs;
  v_old_order public.orders;
  v_existing_order public.orders;
  v_recommended public.combo_packages;
  v_component record;
  v_physical_stock integer;
  v_reserved integer;
  v_available integer;
  v_difference numeric;
  v_payment_method text;
  v_order public.orders;
  v_order_number text;
  v_reference text;
  v_order_item_id uuid;
  v_expires_at timestamptz;
  v_expiry_minutes integer;
  v_components_snapshot jsonb;
  v_product public.products;
begin
  if v_customer_id is null then
    raise exception 'You must be logged in';
  end if;

  select * into v_job from public.installation_jobs where id = p_installation_job_id;
  if not found or v_job.customer_id <> v_customer_id then
    raise exception 'Installation job not found';
  end if;

  if v_job.status <> 'awaiting_customer_decision' or v_job.recommended_package_id is null then
    raise exception 'No package upgrade is available for this order';
  end if;

  select * into v_old_order from public.orders where id = v_job.order_id for update;

  -- Idempotent, and safe against re-clicking "accept" from a fresh page
  -- load (a new idempotency key): a still-in-flight upgrade order for
  -- this same original order is reused rather than duplicated.
  select * into v_existing_order
    from public.orders
    where upgrade_from_order_id = v_old_order.id and status in ('pending_payment', 'payment_processing')
    order by created_at desc
    limit 1;

  if found then
    return query select v_existing_order.id, v_existing_order.order_number, v_existing_order.paystack_reference,
      v_existing_order.amount_payable, v_existing_order.store_credit_used;
    return;
  end if;

  if p_idempotency_key is not null then
    select * into v_existing_order from public.orders
      where customer_id = v_customer_id and client_idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing_order.id, v_existing_order.order_number, v_existing_order.paystack_reference,
        v_existing_order.amount_payable, v_existing_order.store_credit_used;
      return;
    end if;
  end if;

  select * into v_recommended from public.combo_packages where id = v_job.recommended_package_id;
  if not found or not v_recommended.is_active or not v_recommended.is_visible_on_website then
    raise exception 'The recommended package is no longer available';
  end if;

  select reservation_expiry_minutes into v_expiry_minutes from public.app_settings;
  v_expiry_minutes := coalesce(v_expiry_minutes, 30);
  v_expires_at := now() + make_interval(mins => v_expiry_minutes);

  for v_component in
    select c.product_id, c.quantity
    from public.combo_package_components c
    where c.combo_package_id = v_recommended.id and c.product_id is not null
    order by c.product_id
  loop
    select quantity into v_physical_stock
      from public.product_stock
      where product_id = v_component.product_id and branch_id = v_job.branch_id
      for update;
    v_physical_stock := coalesce(v_physical_stock, 0);

    select coalesce(sum(quantity), 0) into v_reserved
      from public.stock_reservations
      where product_id = v_component.product_id and branch_id = v_job.branch_id
        and status = 'active' and expires_at > now();

    v_available := v_physical_stock - v_reserved;

    if v_available < v_component.quantity then
      raise exception 'The recommended package is no longer fully available at this branch';
    end if;
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object('name', c.display_name, 'sku', p.sku, 'quantity', c.quantity, 'componentType', c.component_type)
    order by c.display_order, c.display_name
  ), '[]'::jsonb)
    into v_components_snapshot
    from public.combo_package_components c
    left join public.products p on p.id = c.product_id
    where c.combo_package_id = v_recommended.id;

  -- Section 29: "do not allow downgrade cash-out" -- floor at zero
  -- instead of ever producing a negative (refundable) amount.
  v_difference := greatest(0, v_recommended.final_price - v_old_order.amount_paid);
  v_payment_method := case when v_difference = 0 then 'package_upgrade_credit' else 'paystack' end;

  v_order_number := 'GE-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_reference := v_order_number;

  insert into public.orders (
    order_number, customer_id, branch_id, order_type, status, payment_status, payment_method,
    subtotal, store_credit_used, amount_payable, customer_name, customer_email, customer_phone,
    paystack_reference, reservation_expires_at, client_idempotency_key, upgrade_from_order_id
  ) values (
    v_order_number, v_customer_id, v_job.branch_id, 'combo_package', 'pending_payment', 'unpaid', v_payment_method,
    v_recommended.final_price, 0, v_difference, v_old_order.customer_name, v_old_order.customer_email, v_old_order.customer_phone,
    v_reference, v_expires_at, p_idempotency_key, v_old_order.id
  )
  returning * into v_order;

  insert into public.combo_order_details (
    order_id, combo_package_id, package_code, package_name, package_slug, final_price,
    system_capacity_text, appliances_supported, installation_scope, warranty_text,
    inspection_required, components, branch_id, quantity
  ) values (
    -- inspection_required is forced false here even if the recommended
    -- package's own default is true: the customer's site was already
    -- physically inspected as part of the original job, which is WHY
    -- this specific higher-capacity package was recommended in the first
    -- place -- re-inspecting would just loop the customer back through a
    -- step staff already completed.
    v_order.id, v_recommended.id, v_recommended.package_code, v_recommended.name, v_recommended.website_slug,
    v_recommended.final_price, v_recommended.system_capacity_text, v_recommended.appliances_supported,
    v_recommended.installation_scope, v_recommended.warranty_text, false, v_components_snapshot, v_job.branch_id, 1
  );

  for v_component in
    select c.product_id, c.quantity
    from public.combo_package_components c
    where c.combo_package_id = v_recommended.id and c.product_id is not null
  loop
    select * into v_product from public.products where id = v_component.product_id;

    insert into public.order_items (
      order_id, product_id, product_name, product_sku, product_slug, product_image_url, website_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku, v_product.website_slug, v_product.product_image_url,
      0, v_component.quantity, 0
    )
    returning id into v_order_item_id;

    insert into public.stock_reservations (order_id, order_item_id, product_id, branch_id, quantity, status, expires_at)
    values (v_order.id, v_order_item_id, v_product.id, v_job.branch_id, v_component.quantity, 'active', v_expires_at);
  end loop;

  if v_difference = 0 then
    perform public.finalize_successful_online_order(v_reference, 0, 'PACKAGE_UPGRADE');
    select * into v_order from public.orders where id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number, v_order.paystack_reference, v_order.amount_payable, v_order.store_credit_used;
end;
$$;

revoke all on function public.accept_package_upgrade(uuid, text) from public;
revoke all on function public.accept_package_upgrade(uuid, text) from anon;
grant execute on function public.accept_package_upgrade(uuid, text) to authenticated;

-- Read-only preview for the package decision page, so a customer sees
-- what accepting the upgrade will actually cost before calling
-- accept_package_upgrade. No side effects, no locking.
create function public.get_package_upgrade_quote(p_installation_job_id uuid)
returns table (
  recommended_package_name text,
  recommended_final_price numeric,
  original_amount_paid numeric,
  amount_due numeric,
  availability_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.installation_jobs;
  v_order public.orders;
  v_recommended public.combo_packages;
begin
  select * into v_job from public.installation_jobs where id = p_installation_job_id;
  if not found or v_job.customer_id <> auth.uid() or v_job.recommended_package_id is null then
    raise exception 'No package upgrade is available for this order';
  end if;

  select * into v_order from public.orders where id = v_job.order_id;
  select * into v_recommended from public.combo_packages where id = v_job.recommended_package_id;
  if not found then
    raise exception 'The recommended package is no longer available';
  end if;

  return query select
    v_recommended.name,
    v_recommended.final_price,
    v_order.amount_paid,
    greatest(0, v_recommended.final_price - v_order.amount_paid),
    public.get_combo_package_availability(v_recommended.id, v_job.branch_id);
end;
$$;

revoke all on function public.get_package_upgrade_quote(uuid) from public;
revoke all on function public.get_package_upgrade_quote(uuid) from anon;
grant execute on function public.get_package_upgrade_quote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 17. Refund requests: customer actions, approval, processing
-- ---------------------------------------------------------------------

-- Section 19/20: a customer requesting money back on an ALREADY-PAID
-- order that has nothing to do with the inspection workflow (any paid
-- order, product or package). Distinct from submit_package_decision
-- below, which only ever fires from an awaiting_customer_decision
-- installation job.
create function public.request_paid_order_cancellation(p_order_id uuid, p_reason text)
returns public.refund_requests
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_request public.refund_requests;
begin
  select * into v_order from public.orders where id = p_order_id and customer_id = auth.uid();
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status <> 'successful' then
    raise exception 'Only a paid order can be requested for cancellation here';
  end if;

  if exists (
    select 1 from public.refund_requests
    where order_id = p_order_id and status not in ('rejected', 'completed', 'failed')
  ) then
    raise exception 'A refund or cancellation request is already in progress for this order';
  end if;

  insert into public.refund_requests (order_id, customer_id, request_type, reason, requested_amount, status)
  values (p_order_id, auth.uid(), 'paid_order_cancellation', nullif(btrim(p_reason), ''), v_order.amount_paid, 'pending')
  returning * into v_request;

  insert into public.notifications (type, message)
  values ('info', 'Customer requested cancellation of paid order ' || v_order.order_number || '.');

  return v_request;
end;
$$;

revoke all on function public.request_paid_order_cancellation(uuid, text) from public;
revoke all on function public.request_paid_order_cancellation(uuid, text) from anon;
grant execute on function public.request_paid_order_cancellation(uuid, text) to authenticated;

-- Section 18: the customer decision page. Only handles the two
-- money-back paths -- accepting the recommended upgrade is a different
-- action (accept_package_upgrade above) since it needs to return
-- order/payment info to redirect to, not just record a choice. Rewrites
-- the pending package_unsuitable request record_inspection_result already
-- created rather than inserting a second row for the same order.
create function public.submit_package_decision(
  p_installation_job_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.refund_requests
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.installation_jobs;
  v_order public.orders;
  v_request public.refund_requests;
  v_request_type text;
begin
  if p_decision not in ('full_refund', 'store_credit') then
    raise exception 'Invalid decision: %', p_decision;
  end if;

  select * into v_job from public.installation_jobs where id = p_installation_job_id;
  if not found or v_job.customer_id <> auth.uid() then
    raise exception 'Installation job not found';
  end if;

  if v_job.status <> 'awaiting_customer_decision' then
    raise exception 'This order is not awaiting a decision';
  end if;

  select * into v_order from public.orders where id = v_job.order_id;
  v_request_type := case when p_decision = 'full_refund' then 'full_refund' else 'store_credit_conversion' end;

  update public.refund_requests
    set request_type = v_request_type,
        reason = coalesce(nullif(btrim(p_reason), ''), reason),
        requested_amount = v_order.amount_paid
    where order_id = v_order.id and status = 'pending' and request_type = 'package_unsuitable'
    returning * into v_request;

  if not found then
    raise exception 'No pending decision is available for this order';
  end if;

  insert into public.notifications (type, message)
  values (
    'info',
    'Customer chose ' || (case when p_decision = 'full_refund' then 'a refund' else 'store credit' end)
      || ' for order ' || v_order.order_number || ' -- awaiting approval.'
  );

  return v_request;
end;
$$;

revoke all on function public.submit_package_decision(uuid, text, text) from public;
revoke all on function public.submit_package_decision(uuid, text, text) from anon;
grant execute on function public.submit_package_decision(uuid, text, text) to authenticated;

-- Section 20: Manager may approve operationally; Owner is always
-- notified and gives final approval (owner_approve_refund_request below)
-- before anything is actually processed. A Manager approving alone never
-- triggers a refund or store credit by itself.
create function public.manager_approve_refund_request(p_refund_request_id uuid)
returns public.refund_requests
language plpgsql
security definer set search_path = ''
as $$
declare
  v_request public.refund_requests;
  v_order public.orders;
begin
  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    raise exception 'Refund request not found';
  end if;

  select * into v_order from public.orders where id = v_request.order_id;

  if not public.can_manage_branch(v_order.branch_id) then
    raise exception 'You are not permitted to review refund requests for this branch';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been reviewed';
  end if;
  if v_request.request_type = 'package_unsuitable' then
    raise exception 'Waiting on the customer''s decision before this can be approved';
  end if;

  update public.refund_requests
    set status = 'manager_approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_request.id
    returning * into v_request;

  insert into public.notifications (type, message)
  values ('warning', 'Refund request for order ' || v_order.order_number || ' was approved by a Manager -- Owner approval required.');

  return v_request;
end;
$$;

revoke all on function public.manager_approve_refund_request(uuid) from public;
grant execute on function public.manager_approve_refund_request(uuid) to authenticated;

-- Internal only: credits the customer's store credit balance, restores
-- stock, and closes out the order/installation job. Called only from
-- owner_approve_refund_request once a store_credit_conversion request has
-- Owner approval -- never reachable directly, and never calls Paystack.
create function public.convert_refund_to_store_credit(p_refund_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.refund_requests;
  v_order public.orders;
begin
  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if v_request.status <> 'owner_approved' then
    raise exception 'Refund request must be Owner-approved before converting to store credit';
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;

  perform public.credit_store_credit_account(
    v_order.customer_id, v_request.requested_amount, 'refund_conversion', v_order.id, v_request.id,
    'Store credit for cancelled order ' || v_order.order_number, v_request.approved_by
  );

  perform public.restore_order_stock(v_order.id);

  update public.installation_jobs
    set status = 'refunded'
    where order_id = v_order.id and status not in ('installation_completed', 'cancelled', 'refunded');

  update public.orders
    set status = 'cancelled', payment_status = 'refunded', cancelled_at = now(),
        cancellation_reason = 'Converted to store credit'
    where id = v_order.id;

  update public.refund_requests set status = 'completed', completed_at = now() where id = v_request.id;

  insert into public.notifications (type, message)
  values ('success', 'Store credit issued for order ' || v_order.order_number || '.');
end;
$$;

revoke all on function public.convert_refund_to_store_credit(uuid) from public, anon, authenticated;

-- Section 20/21: final approval, Owner-only. A full_refund/
-- paid_order_cancellation request is moved to 'processing' here -- the
-- actual Paystack refund call happens outside the database (see
-- record_paystack_refund_result below and
-- STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md for exactly where). A
-- store_credit_conversion request is fully resolved in this same call,
-- since it needs no external API.
create function public.owner_approve_refund_request(p_refund_request_id uuid)
returns public.refund_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.refund_requests;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner can give final approval on a refund';
  end if;

  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    raise exception 'Refund request not found';
  end if;
  if v_request.status not in ('pending', 'manager_approved') then
    raise exception 'This request is not awaiting Owner approval';
  end if;
  if v_request.request_type = 'package_unsuitable' then
    raise exception 'Waiting on the customer''s decision before this can be approved';
  end if;

  update public.refund_requests
    set status = 'owner_approved', approved_by = auth.uid(), approved_at = now()
    where id = v_request.id
    returning * into v_request;

  if v_request.request_type = 'store_credit_conversion' then
    perform public.convert_refund_to_store_credit(v_request.id);
  else
    update public.refund_requests set status = 'processing' where id = v_request.id;
  end if;

  select * into v_request from public.refund_requests where id = p_refund_request_id;
  return v_request;
end;
$$;

revoke all on function public.owner_approve_refund_request(uuid) from public;
grant execute on function public.owner_approve_refund_request(uuid) to authenticated;

create function public.reject_refund_request(p_refund_request_id uuid, p_reason text)
returns public.refund_requests
language plpgsql
security definer set search_path = ''
as $$
declare
  v_request public.refund_requests;
  v_order public.orders;
begin
  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    raise exception 'Refund request not found';
  end if;

  select * into v_order from public.orders where id = v_request.order_id;

  if not public.can_manage_branch(v_order.branch_id) then
    raise exception 'You are not permitted to review refund requests for this branch';
  end if;
  if v_request.status not in ('pending', 'manager_approved') then
    raise exception 'This request has already been resolved';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  update public.refund_requests
    set status = 'rejected',
        rejection_reason = p_reason,
        reviewed_by = coalesce(reviewed_by, auth.uid()),
        reviewed_at = coalesce(reviewed_at, now())
    where id = v_request.id
    returning * into v_request;

  insert into public.notifications (type, message)
  values ('info', 'Refund request for order ' || v_order.order_number || ' was rejected.');

  return v_request;
end;
$$;

revoke all on function public.reject_refund_request(uuid, text) from public;
grant execute on function public.reject_refund_request(uuid, text) to authenticated;

-- Section 21: records the outcome of an actual Paystack refund call
-- (made from the BMS app's own server-side code, using its own
-- PAYSTACK_SECRET_KEY -- see STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md for
-- why that lives in the BMS rather than being called from here) OR, if
-- automatic Paystack refund processing isn't wired up/configured, the
-- Owner's manual confirmation after processing the refund directly in
-- the Paystack dashboard. Either way this is the one place a
-- 'processing' request is ever resolved -- Owner-only, and idempotent
-- (a request that isn't 'processing' is left alone rather than
-- re-applied).
create function public.record_paystack_refund_result(
  p_refund_request_id uuid,
  p_paystack_refund_reference text,
  p_status text
)
returns public.refund_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.refund_requests;
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner can record a refund outcome';
  end if;

  if p_status not in ('completed', 'failed') then
    raise exception 'Invalid refund status: %', p_status;
  end if;

  select * into v_request from public.refund_requests where id = p_refund_request_id for update;
  if not found then
    raise exception 'Refund request not found';
  end if;

  if v_request.status <> 'processing' then
    return v_request;
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;

  if p_status = 'failed' then
    update public.refund_requests set status = 'failed' where id = v_request.id returning * into v_request;

    insert into public.notifications (type, message)
    values ('warning', 'Paystack refund failed for order ' || v_order.order_number || ' -- needs manual follow-up.');

    return v_request;
  end if;

  perform public.restore_order_stock(v_order.id);

  update public.installation_jobs
    set status = 'refunded'
    where order_id = v_order.id and status not in ('installation_completed', 'cancelled', 'refunded');

  update public.orders
    set status = 'cancelled', payment_status = 'refunded', cancelled_at = now(),
        cancellation_reason = 'Refunded via Paystack'
    where id = v_order.id;

  update public.refund_requests
    set status = 'completed', paystack_refund_reference = p_paystack_refund_reference, completed_at = now()
    where id = v_request.id
    returning * into v_request;

  insert into public.notifications (type, message)
  values ('success', 'Refund completed for order ' || v_order.order_number || '.');

  return v_request;
end;
$$;

revoke all on function public.record_paystack_refund_result(uuid, text, text) from public;
grant execute on function public.record_paystack_refund_result(uuid, text, text) to authenticated;

-- Section 24: "Staff adjustments require Owner/Admin approval" -- a
-- manual correction tool for the rare case (goodwill credit, correcting a
-- mistake) that doesn't fit the refund-request flow. Owner-only, and
-- always leaves an auditable ledger row -- there is no way to change
-- store_credit_accounts.balance from anywhere in this schema without one.
create function public.admin_adjust_store_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_description text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Owner/Admin can adjust store credit';
  end if;
  if p_amount = 0 then
    raise exception 'Adjustment amount cannot be zero';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception 'An adjustment description is required';
  end if;

  if p_amount > 0 then
    return public.credit_store_credit_account(p_customer_id, p_amount, 'adjustment', null, null, p_description, auth.uid());
  else
    return public.debit_store_credit_account(p_customer_id, abs(p_amount), 'adjustment', null, null, p_description, auth.uid());
  end if;
end;
$$;

revoke all on function public.admin_adjust_store_credit(uuid, numeric, text) from public;
grant execute on function public.admin_adjust_store_credit(uuid, numeric, text) to authenticated;
