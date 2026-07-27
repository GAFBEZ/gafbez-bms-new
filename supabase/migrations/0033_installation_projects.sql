-- Stage 8: Installation Project gallery (public marketing content) +
-- "Request Similar Installation" enquiries, plus a handful of database
-- hardening fixes found during the Stage 8 final security/RLS audit.
--
-- Naming note: this project already has TWO unrelated tables with similar
-- names -- public.installations (0025-0027: an internal parts-cost/profit
-- record per completed job, admin-only, nothing to do with marketing) and
-- public.installation_jobs (0031: the site-inspection -> installation
-- workflow attached to a combo-package order). public.installation_projects
-- below is a THIRD, distinct concept: public marketing case studies shown
-- on the website's homepage rotator and /installations gallery. It shares
-- no columns, no RLS, and no code path with either existing table -- do
-- not confuse the three when reading migrations later.
--
-- Permission note: "Owner and Manager may manage installation projects;
-- Salespeople must not unless an existing role rule explicitly permits
-- it" (brief section 2) maps exactly onto the role model 0031 already
-- built: role='admin' (Owner/Admin), is_branch_manager (Manager, any
-- branch -- installation projects are global marketing content, not
-- branch-scoped, so no branch match is required here unlike
-- can_manage_branch()), or can_manage_installations (the existing
-- Owner-granted "explicit permission" escape hatch for a salesperson).
-- No new profiles column was added, so prevent_profile_privilege_escalation()
-- needs no changes.
--
-- Audit note: this schema's established convention (confirmed across
-- every Stage 5/6/7 table) is row-level created_by/updated_by + a
-- set_updated_at trigger, not a separate audit-log table. Followed here
-- for consistency rather than introducing a new audit mechanism.

-- ---------------------------------------------------------------------
-- 1. can_manage_installation_projects()
-- ---------------------------------------------------------------------

create function public.can_manage_installation_projects()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or is_branch_manager or can_manage_installations)
  );
$$;

comment on function public.can_manage_installation_projects() is 'Owner (role=admin), any branch Manager (is_branch_manager), or an Owner-approved salesperson (can_manage_installations) -- installation projects are global marketing content, not branch-scoped, so unlike can_manage_branch() no branch match is required.';

-- ---------------------------------------------------------------------
-- 2. installation_projects
-- ---------------------------------------------------------------------

create table public.installation_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  website_slug text not null unique check (btrim(website_slug) <> ''),
  location text,
  installation_date date,
  system_capacity text,
  short_description text,
  full_description text,
  main_image_url text,
  gallery_image_urls jsonb not null default '[]'::jsonb,
  project_type text,
  products_used jsonb not null default '[]'::jsonb,
  customer_testimonial text,
  -- Only ever shown publicly if a staff member deliberately typed a name
  -- here -- see the brief's "do not show customer names unless
  -- intentionally approved" rule (section 9). Free text, not a
  -- customer_profiles FK, same "standalone record" reasoning 0026 used
  -- for public.installations.customer_name.
  testimonial_author_name text,
  is_featured boolean not null default false,
  is_visible_on_website boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installation_projects_gallery_is_array check (jsonb_typeof(gallery_image_urls) = 'array'),
  constraint installation_projects_products_used_is_array check (jsonb_typeof(products_used) = 'array')
);

comment on table public.installation_projects is 'Public marketing case studies for the homepage rotator and /installations gallery. Distinct from public.installations (internal cost/profit record) and public.installation_jobs (per-order site-inspection workflow) -- see this migration''s header comment.';
comment on column public.installation_projects.location is 'General/public-facing location only (e.g. "Garki, Abuja") -- never an exact private residential address.';
comment on column public.installation_projects.products_used is 'Plain JSON array of free-text product/brand names for public display (e.g. ["Deye 8kVA Hybrid Inverter", "620W Monocrystalline Panel"]) -- not product IDs, so this never links back to internal inventory/pricing.';

create trigger set_installation_projects_updated_at
  before update on public.installation_projects
  for each row execute procedure public.set_updated_at();

alter table public.installation_projects enable row level security;

create policy "Public can read visible installation projects"
  on public.installation_projects
  for select
  to anon, authenticated
  using (is_visible_on_website = true);

create policy "Staff can read all installation projects"
  on public.installation_projects
  for select
  to authenticated
  using (true);

-- Deliberately no insert/update/delete policy -- all writes go through
-- the SECURITY DEFINER functions below, same convention as every table
-- since Stage 6.
grant select on public.installation_projects to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Safe public view
-- ---------------------------------------------------------------------
-- Same shape/precedent as public.website_catalogue (0028): a plain view,
-- not a function, since installation projects have no per-branch
-- dimension to compute (unlike combo packages, which needed an RPC for
-- branch-specific availability). Runs as the view owner, bypassing RLS
-- the same safe way website_catalogue does; only the columns listed below
-- are reachable, so created_by/updated_by are simply never exposed.

create view public.website_installation_projects as
select
  p.id,
  p.title,
  p.website_slug,
  p.location,
  p.installation_date,
  p.system_capacity,
  p.short_description,
  p.full_description,
  p.main_image_url,
  p.gallery_image_urls,
  p.project_type,
  p.products_used,
  p.customer_testimonial,
  p.testimonial_author_name,
  p.is_featured,
  p.display_order
from public.installation_projects p
where p.is_visible_on_website = true;

grant select on public.website_installation_projects to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Admin/Manager CRUD functions
-- ---------------------------------------------------------------------

create function public.create_installation_project(
  p_title text,
  p_website_slug text,
  p_location text,
  p_installation_date date,
  p_system_capacity text,
  p_short_description text,
  p_full_description text,
  p_main_image_url text,
  p_gallery_image_urls jsonb,
  p_project_type text,
  p_products_used jsonb,
  p_customer_testimonial text,
  p_testimonial_author_name text,
  p_is_visible_on_website boolean,
  p_is_featured boolean,
  p_display_order integer
)
returns public.installation_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_row public.installation_projects;
begin
  if not public.can_manage_installation_projects() then
    raise exception 'Only the Owner or a branch Manager can create installation projects';
  end if;

  v_slug := nullif(btrim(p_website_slug), '');
  if v_slug is null then
    raise exception 'A website slug is required';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'A title is required';
  end if;

  if jsonb_typeof(p_gallery_image_urls) is distinct from 'array' then
    raise exception 'Gallery images must be a JSON array';
  end if;

  if jsonb_typeof(p_products_used) is distinct from 'array' then
    raise exception 'Products used must be a JSON array';
  end if;

  if p_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;

  if exists (select 1 from public.installation_projects where website_slug = v_slug) then
    raise exception 'That slug is already in use -- choose a different one';
  end if;

  insert into public.installation_projects (
    title, website_slug, location, installation_date, system_capacity,
    short_description, full_description, main_image_url, gallery_image_urls,
    project_type, products_used, customer_testimonial, testimonial_author_name,
    is_visible_on_website, is_featured, display_order, created_by, updated_by
  ) values (
    btrim(p_title), v_slug, nullif(btrim(p_location), ''), p_installation_date,
    nullif(btrim(p_system_capacity), ''), nullif(btrim(p_short_description), ''),
    nullif(btrim(p_full_description), ''), nullif(btrim(p_main_image_url), ''),
    p_gallery_image_urls, nullif(btrim(p_project_type), ''), p_products_used,
    nullif(btrim(p_customer_testimonial), ''), nullif(btrim(p_testimonial_author_name), ''),
    p_is_visible_on_website, p_is_featured, p_display_order, auth.uid(), auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_installation_project(
  text, text, text, date, text, text, text, text, jsonb, text, jsonb, text, text, boolean, boolean, integer
) from public;
grant execute on function public.create_installation_project(
  text, text, text, date, text, text, text, text, jsonb, text, jsonb, text, text, boolean, boolean, integer
) to authenticated;

create function public.update_installation_project(
  p_id uuid,
  p_title text,
  p_website_slug text,
  p_location text,
  p_installation_date date,
  p_system_capacity text,
  p_short_description text,
  p_full_description text,
  p_main_image_url text,
  p_gallery_image_urls jsonb,
  p_project_type text,
  p_products_used jsonb,
  p_customer_testimonial text,
  p_testimonial_author_name text,
  p_is_visible_on_website boolean,
  p_is_featured boolean,
  p_display_order integer
)
returns public.installation_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_row public.installation_projects;
begin
  if not public.can_manage_installation_projects() then
    raise exception 'Only the Owner or a branch Manager can edit installation projects';
  end if;

  v_slug := nullif(btrim(p_website_slug), '');
  if v_slug is null then
    raise exception 'A website slug is required';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'A title is required';
  end if;

  if jsonb_typeof(p_gallery_image_urls) is distinct from 'array' then
    raise exception 'Gallery images must be a JSON array';
  end if;

  if jsonb_typeof(p_products_used) is distinct from 'array' then
    raise exception 'Products used must be a JSON array';
  end if;

  if p_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;

  if exists (select 1 from public.installation_projects where website_slug = v_slug and id <> p_id) then
    raise exception 'That slug is already in use -- choose a different one';
  end if;

  update public.installation_projects
    set title = btrim(p_title),
        website_slug = v_slug,
        location = nullif(btrim(p_location), ''),
        installation_date = p_installation_date,
        system_capacity = nullif(btrim(p_system_capacity), ''),
        short_description = nullif(btrim(p_short_description), ''),
        full_description = nullif(btrim(p_full_description), ''),
        main_image_url = nullif(btrim(p_main_image_url), ''),
        gallery_image_urls = p_gallery_image_urls,
        project_type = nullif(btrim(p_project_type), ''),
        products_used = p_products_used,
        customer_testimonial = nullif(btrim(p_customer_testimonial), ''),
        testimonial_author_name = nullif(btrim(p_testimonial_author_name), ''),
        is_visible_on_website = p_is_visible_on_website,
        is_featured = p_is_featured,
        display_order = p_display_order,
        updated_by = auth.uid()
    where installation_projects.id = p_id
    returning * into v_row;

  if not found then
    raise exception 'Installation project not found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_installation_project(
  uuid, text, text, text, date, text, text, text, text, jsonb, text, jsonb, text, text, boolean, boolean, integer
) from public;
grant execute on function public.update_installation_project(
  uuid, text, text, text, date, text, text, text, text, jsonb, text, jsonb, text, text, boolean, boolean, integer
) to authenticated;

create function public.set_installation_project_status(
  p_id uuid,
  p_is_visible_on_website boolean,
  p_is_featured boolean
)
returns public.installation_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.installation_projects;
begin
  if not public.can_manage_installation_projects() then
    raise exception 'Only the Owner or a branch Manager can change installation project visibility';
  end if;

  update public.installation_projects
    set is_visible_on_website = p_is_visible_on_website,
        is_featured = p_is_featured,
        updated_by = auth.uid()
    where installation_projects.id = p_id
    returning * into v_row;

  if not found then
    raise exception 'Installation project not found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_installation_project_status(uuid, boolean, boolean) from public;
grant execute on function public.set_installation_project_status(uuid, boolean, boolean) to authenticated;

create function public.set_installation_project_display_order(p_id uuid, p_display_order integer)
returns public.installation_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.installation_projects;
begin
  if not public.can_manage_installation_projects() then
    raise exception 'Only the Owner or a branch Manager can reorder installation projects';
  end if;

  if p_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;

  update public.installation_projects
    set display_order = p_display_order,
        updated_by = auth.uid()
    where installation_projects.id = p_id
    returning * into v_row;

  if not found then
    raise exception 'Installation project not found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_installation_project_display_order(uuid, integer) from public;
grant execute on function public.set_installation_project_display_order(uuid, integer) to authenticated;

create function public.delete_installation_project(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_installation_projects() then
    raise exception 'Only the Owner or a branch Manager can delete installation projects';
  end if;

  delete from public.installation_projects where id = p_id;

  if not found then
    raise exception 'Installation project not found';
  end if;
end;
$$;

revoke all on function public.delete_installation_project(uuid) from public;
grant execute on function public.delete_installation_project(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. installation-images Storage bucket
-- ---------------------------------------------------------------------
-- Same shape as product-images/combo-package-images (public read, 5MB,
-- jpeg/png/webp), but a deliberate deviation on write access: those two
-- buckets are admin-only, while the brief explicitly asks for Owner AND
-- Manager upload/replace/delete here, so the write policies use
-- can_manage_installation_projects() instead of is_admin().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'installation-images',
  'installation-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read installation images"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'installation-images');

create policy "Owner and Manager can upload installation images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'installation-images' and public.can_manage_installation_projects());

create policy "Owner and Manager can update installation images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'installation-images' and public.can_manage_installation_projects())
  with check (bucket_id = 'installation-images' and public.can_manage_installation_projects());

create policy "Owner and Manager can delete installation images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'installation-images' and public.can_manage_installation_projects());

-- ---------------------------------------------------------------------
-- 6. installation_enquiries ("Request Similar Installation")
-- ---------------------------------------------------------------------
-- Same anon+authenticated write pattern as Stage 7's
-- load_calculator_quotation_requests: a marketing lead, not a financial/
-- stock action, so a guest can submit one without an account. Surfaced to
-- staff via the existing flat public.notifications table -- see the
-- header comment on notify-targeting limitations below function
-- submit_installation_enquiry().

create table public.installation_enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users (id) on delete set null,
  name text not null check (btrim(name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  email text not null check (btrim(email) <> ''),
  branch_id text not null references public.branches (id),
  installation_project_id uuid references public.installation_projects (id) on delete set null,
  general_location text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

comment on table public.installation_enquiries is '"Request Similar Installation" leads from the public /installations pages. Never exposed publicly -- customer-own/staff-only read, see RLS below.';

alter table public.installation_enquiries enable row level security;

create policy "Customers can read their own installation enquiries"
  on public.installation_enquiries
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all installation enquiries"
  on public.installation_enquiries
  for select
  to authenticated
  using (public.is_admin());

create policy "Branch staff can read their branch's installation enquiries"
  on public.installation_enquiries
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and branch_id = installation_enquiries.branch_id));

-- No insert/update/delete policy -- see submit_installation_enquiry() below.
grant select on public.installation_enquiries to authenticated;

create function public.submit_installation_enquiry(
  p_name text,
  p_phone text,
  p_email text,
  p_branch_id text,
  p_installation_project_id uuid,
  p_general_location text,
  p_message text
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
  v_project_title text;
begin
  if btrim(coalesce(p_name, '')) = '' or btrim(coalesce(p_phone, '')) = '' or btrim(coalesce(p_email, '')) = '' then
    raise exception 'Name, phone, and email are required';
  end if;

  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select name into v_branch_name from public.branches where id = p_branch_id and status = 'active';
  if not found then
    raise exception 'Unknown or inactive branch: %', p_branch_id;
  end if;

  if p_installation_project_id is not null then
    select title into v_project_title from public.installation_projects
      where id = p_installation_project_id and is_visible_on_website = true;
    if not found then
      raise exception 'That installation project is no longer available';
    end if;
  end if;

  insert into public.installation_enquiries (
    customer_id, name, phone, email, branch_id, installation_project_id, general_location, message
  ) values (
    v_customer_id, btrim(p_name), btrim(p_phone), btrim(p_email), p_branch_id,
    p_installation_project_id, nullif(btrim(p_general_location), ''), nullif(btrim(p_message), '')
  )
  returning id into v_id;

  -- Note: public.notifications (0009) is a flat, un-targeted table -- any
  -- authenticated staff member can read every notification, regardless of
  -- role or branch. There is no per-recipient delivery mechanism in this
  -- schema to page only the Owner and the selected branch's Manager, so
  -- this (like every other Stage 5-7 notification) is a best-effort
  -- broadcast with the branch named in the message text, not a targeted
  -- page. Documented as a known limitation in STAGE_8_FINAL_RELEASE_NOTES.md.
  insert into public.notifications (type, message)
  values (
    'info',
    btrim(p_name) || ' (' || btrim(p_phone) || ') requested a similar installation at '
      || coalesce(v_branch_name, p_branch_id)
      || coalesce(' referencing "' || v_project_title || '"', '') || '.'
  );

  return v_id;
end;
$$;

revoke all on function public.submit_installation_enquiry(text, text, text, text, uuid, text, text) from public;
grant execute on function public.submit_installation_enquiry(text, text, text, text, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Stage 8 database hardening fixes (section 29 of the brief)
-- ---------------------------------------------------------------------
-- Missing indexes on foreign-key columns found during the Stage 8 audit.
-- Postgres does not auto-index FK columns (unlike primary keys), and
-- these are all columns queried by RLS policies or lookups added in
-- Stages 5-7, so an unindexed FK here means an increasingly slow
-- sequential scan as the tables grow -- this is a pure performance fix,
-- no behaviour change. "if not exists" guards make this migration safe
-- to re-run.

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_stock_reservations_order_id on public.stock_reservations (order_id);
create index if not exists idx_installation_jobs_order_id on public.installation_jobs (order_id);
create index if not exists idx_installation_jobs_customer_id on public.installation_jobs (customer_id);
create index if not exists idx_refund_requests_order_id on public.refund_requests (order_id);
create index if not exists idx_refund_requests_customer_id on public.refund_requests (customer_id);
create index if not exists idx_store_credit_ledger_customer_id on public.store_credit_ledger (customer_id);
create index if not exists idx_combo_order_details_order_id on public.combo_order_details (order_id);
create index if not exists idx_customer_load_calculations_customer_id on public.customer_load_calculations (customer_id);
create index if not exists idx_load_calculator_quotation_requests_branch_id on public.load_calculator_quotation_requests (branch_id);
create index if not exists idx_installation_enquiries_branch_id on public.installation_enquiries (branch_id);
create index if not exists idx_installation_enquiries_customer_id on public.installation_enquiries (customer_id);
-- installation_projects.website_slug already has a unique constraint
-- (section 2 above), which Postgres already backs with its own unique
-- btree index -- no separate index needed here.

create index if not exists idx_stock_movements_product_id on public.stock_movements (product_id);
create index if not exists idx_stock_movements_branch_id on public.stock_movements (branch_id);
create index if not exists idx_stock_movements_created_by on public.stock_movements (created_by);
create index if not exists idx_sales_customer_id on public.sales (customer_id);
create index if not exists idx_sales_branch_id on public.sales (branch_id);
create index if not exists idx_sales_created_by on public.sales (created_by);
create index if not exists idx_sale_items_sale_id on public.sale_items (sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items (product_id);
create index if not exists idx_sale_returns_sale_item_id on public.sale_returns (sale_item_id);
create index if not exists idx_sale_returns_created_by on public.sale_returns (created_by);
create index if not exists idx_customers_branch_id on public.customers (branch_id);
create index if not exists idx_expenses_branch_id on public.expenses (branch_id);
create index if not exists idx_expenses_created_by on public.expenses (created_by);
create index if not exists idx_documents_branch_id on public.documents (branch_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_profiles_branch_id on public.profiles (branch_id);
create index if not exists idx_installations_branch_id on public.installations (branch_id);
create index if not exists idx_installations_inverter_product_id on public.installations (inverter_product_id);
create index if not exists idx_installations_solar_panel_product_id on public.installations (solar_panel_product_id);
create index if not exists idx_installations_battery_product_id on public.installations (battery_product_id);
create index if not exists idx_installations_created_by on public.installations (created_by);
create index if not exists idx_store_credit_ledger_order_id on public.store_credit_ledger (order_id);
create index if not exists idx_installation_jobs_combo_package_id on public.installation_jobs (combo_package_id);
create index if not exists idx_installation_jobs_recommended_package_id on public.installation_jobs (recommended_package_id);
create index if not exists idx_installation_jobs_assigned_staff_id on public.installation_jobs (assigned_staff_id);
create index if not exists idx_refund_requests_reviewed_by on public.refund_requests (reviewed_by);
create index if not exists idx_refund_requests_approved_by on public.refund_requests (approved_by);
create index if not exists idx_combo_order_details_combo_package_id on public.combo_order_details (combo_package_id);
create index if not exists idx_combo_order_details_branch_id on public.combo_order_details (branch_id);
create index if not exists idx_customer_load_calculations_branch_id on public.customer_load_calculations (branch_id);
create index if not exists idx_load_calculator_quotation_requests_customer_id on public.load_calculator_quotation_requests (customer_id);
create index if not exists idx_customer_profile_audit_customer_id on public.customer_profile_audit (customer_id);

-- ---------------------------------------------------------------------
-- 8. Stage 8 RLS security hardening (brief section 17)
-- ---------------------------------------------------------------------
-- Found during the Stage 8 security audit: 0029_customer_accounts_and_cart.sql
-- put website customers on the same Postgres `authenticated` role as BMS
-- staff. Every Stage 1/2 table whose RLS policy was written as a blanket
-- `to authenticated using (true)` -- written back when "authenticated"
-- only ever meant "a signed-in staff member" -- became readable, and in
-- several cases writable, by any signed-up website customer too. This
-- section closes that gap with a new is_staff() check, and separately
-- fixes a product_stock/products bypass of the admin-only RPC layer that
-- 0022 (Inventory Master admin lockdown) never reached at the RLS layer.

create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

comment on function public.is_staff() is 'True only for a BMS staff session (a row in public.profiles). Website customers get a public.customer_profiles row instead (0029) and never a profiles row, so this cleanly distinguishes "any staff, any role" from "a customer" now that both share the authenticated Postgres role.';

-- 8.1 product_stock: was `for all using(true) with check(true)` -- any
-- authenticated session (including a customer) could write or delete the
-- real per-branch stock ledger directly, bypassing every quantity guard
-- in record_stock_movement()/record_sale()/finalize_successful_online_order().
-- Confirmed no legitimate direct-write code path exists anywhere in
-- either app -- every real write to this table already goes through a
-- SECURITY DEFINER function, which bypasses RLS entirely and needs no
-- matching write policy -- so the fix removes the write policy outright
-- rather than merely tightening it. The safe public catalogue (the
-- website_catalogue view and get_website_catalogue_by_branch(), both
-- 0028) are unaffected: a view/SECURITY DEFINER function reads as its
-- owner, bypassing this table's RLS the same way it always has.
drop policy "Authenticated users can write product stock" on public.product_stock;
drop policy "Authenticated users can read product stock" on public.product_stock;

create policy "Staff can read product stock"
  on public.product_stock
  for select
  to authenticated
  using (public.is_staff());

-- 8.2 products: create_product()/update_product() have been admin-gated
-- inside the function body since 0022, but the raw table policy was never
-- tightened to match -- any authenticated session could still insert or
-- update public.products directly (including cost_price, selling_price,
-- is_active) via PostgREST, exactly the bypass 0022's own comment warned
-- against, just one layer down. No direct insert/update code path exists
-- in either app; delete was already correctly admin-gated (0008). Read is
-- tightened to staff-only too, since cost_price/selling_price/
-- reorder_level/supplier are real columns on this table -- the public
-- site only ever reads the safe website_catalogue view/RPC, never this
-- table directly.
drop policy "Authenticated users can read products" on public.products;
drop policy "Authenticated users can insert products" on public.products;
drop policy "Authenticated users can update products" on public.products;

create policy "Staff can read products"
  on public.products
  for select
  to authenticated
  using (public.is_staff());

-- 8.3 customers/expenses/notifications/documents (table + storage bucket)
-- have real direct-table Server Action writes in the BMS (no RPC layer
-- for these Stage 1/2 tables), so their policies are tightened to
-- is_staff() rather than dropped. sales/sale_items/stock_movements/
-- sale_returns have no direct-write code path (record_sale()/
-- record_stock_movement()/record_return() are all confirmed SECURITY
-- DEFINER) but are tightened the same way for consistent read-scoping.

drop policy "Authenticated users can read customers" on public.customers;
drop policy "Authenticated users can insert customers" on public.customers;
drop policy "Authenticated users can update customers" on public.customers;
drop policy "Authenticated users can delete customers" on public.customers;
create policy "Staff can read customers" on public.customers for select to authenticated using (public.is_staff());
create policy "Staff can insert customers" on public.customers for insert to authenticated with check (public.is_staff());
create policy "Staff can update customers" on public.customers for update to authenticated using (public.is_staff());
create policy "Staff can delete customers" on public.customers for delete to authenticated using (public.is_staff());

drop policy "Authenticated users can read expenses" on public.expenses;
drop policy "Authenticated users can insert expenses" on public.expenses;
drop policy "Authenticated users can update expenses" on public.expenses;
drop policy "Authenticated users can delete expenses" on public.expenses;
create policy "Staff can read expenses" on public.expenses for select to authenticated using (public.is_staff());
create policy "Staff can insert expenses" on public.expenses for insert to authenticated with check (public.is_staff());
create policy "Staff can update expenses" on public.expenses for update to authenticated using (public.is_staff());
create policy "Staff can delete expenses" on public.expenses for delete to authenticated using (public.is_staff());

drop policy "Authenticated users can read notifications" on public.notifications;
drop policy "Authenticated users can insert notifications" on public.notifications;
drop policy "Authenticated users can update notifications" on public.notifications;
create policy "Staff can read notifications" on public.notifications for select to authenticated using (public.is_staff());
create policy "Staff can insert notifications" on public.notifications for insert to authenticated with check (public.is_staff());
create policy "Staff can update notifications" on public.notifications for update to authenticated using (public.is_staff());

drop policy "Authenticated users can read documents in storage" on storage.objects;
drop policy "Authenticated users can upload documents to storage" on storage.objects;
create policy "Staff can read documents in storage"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());
create policy "Staff can upload documents to storage"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_staff());
-- "Only admins can delete documents from storage" (0010) is already
-- correctly is_admin()-gated -- left as-is.

drop policy "Authenticated users can read documents metadata" on public.documents;
drop policy "Authenticated users can insert documents metadata" on public.documents;
create policy "Staff can read documents metadata" on public.documents for select to authenticated using (public.is_staff());
create policy "Staff can insert documents metadata" on public.documents for insert to authenticated with check (public.is_staff());
-- "Only admins can delete documents metadata" (0010) is already correctly
-- is_admin()-gated -- left as-is.

drop policy "Authenticated users can read stock movements" on public.stock_movements;
drop policy "Authenticated users can insert stock movements" on public.stock_movements;
create policy "Staff can read stock movements" on public.stock_movements for select to authenticated using (public.is_staff());
create policy "Staff can insert stock movements" on public.stock_movements for insert to authenticated with check (public.is_staff());

drop policy "Authenticated users can read sales" on public.sales;
drop policy "Authenticated users can insert sales" on public.sales;
create policy "Staff can read sales" on public.sales for select to authenticated using (public.is_staff());
create policy "Staff can insert sales" on public.sales for insert to authenticated with check (public.is_staff());

drop policy "Authenticated users can read sale items" on public.sale_items;
drop policy "Authenticated users can insert sale items" on public.sale_items;
create policy "Staff can read sale items" on public.sale_items for select to authenticated using (public.is_staff());
create policy "Staff can insert sale items" on public.sale_items for insert to authenticated with check (public.is_staff());

drop policy "Authenticated users can read returns" on public.sale_returns;
drop policy "Authenticated users can insert returns" on public.sale_returns;
create policy "Staff can read returns" on public.sale_returns for select to authenticated using (public.is_staff());
create policy "Staff can insert returns" on public.sale_returns for insert to authenticated with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 9. Stage 8 schema hardening: missing FK, missing checks, defense-in-
--    depth anon revokes, cascade fix (brief section 29)
-- ---------------------------------------------------------------------

-- 9.1 store_credit_ledger.refund_request_id had no FK at all, unlike
-- every sibling column on this table, even though every write path
-- treats it as a pointer to refund_requests.id.
alter table public.store_credit_ledger
  add constraint store_credit_ledger_refund_request_id_fkey
  foreign key (refund_request_id) references public.refund_requests (id);

-- 9.2 Missing CHECK constraints on three integer columns that are
-- compared/ordered but were never validated non-negative.
alter table public.combo_packages
  add constraint combo_packages_capacity_rank_check check (capacity_rank >= 0);
alter table public.combo_package_components
  add constraint combo_package_components_display_order_check check (display_order >= 0);
alter table public.app_settings
  add constraint app_settings_default_reorder_level_check check (default_reorder_level >= 0);

-- 9.3 Cascade fix: stock_movements is documented (0004) as an append-only
-- audit ledger "never edited or deleted (audit integrity)", but deleting
-- a product (admins may, 0008) cascaded and permanently destroyed every
-- movement ever logged for it. Changed to restrict, same reasoning
-- 0025_installations.sql already applied to its own product FKs (there,
-- "set null" was chosen instead since those rows have no meaning without
-- being deletable; here, restrict is correct because the audit row must
-- survive -- so the product must not be deletable while movements
-- reference it).
alter table public.stock_movements drop constraint stock_movements_product_id_fkey;
alter table public.stock_movements
  add constraint stock_movements_product_id_fkey
  foreign key (product_id) references public.products (id) on delete restrict;

-- 9.4 Cascade fix: stock_reservations and combo_order_details are both
-- documented as append-only/point-in-time-snapshot tables that nothing in
-- this schema ever deletes an order out from under -- restrict (matching
-- every other order-linked FK: installation_jobs.order_id,
-- refund_requests.order_id, store_credit_ledger.order_id) is more
-- consistent than cascade and is a pure defense-in-depth change (no
-- current behaviour relies on the cascade, since no code path deletes
-- an orders row).
alter table public.stock_reservations drop constraint stock_reservations_order_id_fkey;
alter table public.stock_reservations
  add constraint stock_reservations_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

alter table public.combo_order_details drop constraint combo_order_details_order_id_fkey;
alter table public.combo_order_details
  add constraint combo_order_details_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

-- 9.5 Defense-in-depth: these 14 functions (0031) were only revoked from
-- `public`, unlike every other SECURITY DEFINER function in the schema,
-- which also explicitly revokes from `anon` (0004's own comment: "Supabase
-- grants EXECUTE on new functions directly to anon and authenticated by
-- default... revoking from PUBLIC alone is NOT enough"). Each of these 14
-- already has an internal is_admin()/can_manage_branch()/
-- can_act_on_installation() guard that rejects a null auth.uid() (a
-- genuine anon caller), so this was not currently exploitable -- this
-- just normalizes the grant surface to match the rest of the schema.
revoke all on function public.create_combo_package(
  text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) from anon;
revoke all on function public.update_combo_package(
  uuid, text, text, text, text, text, text, jsonb, numeric, text, integer, jsonb, text, text, boolean, boolean, boolean, boolean, integer, jsonb
) from anon;
revoke all on function public.set_combo_package_status(uuid, boolean, boolean, boolean, integer) from anon;
revoke all on function public.get_combo_package_profit(uuid) from anon;
revoke all on function public.schedule_inspection(uuid, timestamptz, text) from anon;
revoke all on function public.record_inspection_result(uuid, text, text, uuid) from anon;
revoke all on function public.schedule_installation(uuid, timestamptz, uuid) from anon;
revoke all on function public.start_installation(uuid) from anon;
revoke all on function public.complete_installation(uuid) from anon;
revoke all on function public.manager_approve_refund_request(uuid) from anon;
revoke all on function public.owner_approve_refund_request(uuid) from anon;
revoke all on function public.reject_refund_request(uuid, text) from anon;
revoke all on function public.record_paystack_refund_result(uuid, text, text) from anon;
revoke all on function public.admin_adjust_store_credit(uuid, numeric, text) from anon;
