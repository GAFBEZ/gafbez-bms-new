-- Website Catalogue (Stage 2 of the public-site rebuild): lets the Owner/
-- Admin mark existing Inventory Master products as visible on the public
-- website, with their own website-facing copy, price, images, and specs,
-- while keeping cost_price, selling_price, reorder_level, supplier, and the
-- rest of the operational product row private.
--
-- Naming/role note: this project only has two profile roles, 'admin' and
-- 'staff' (see 0002_profiles.sql/0008_role_enforcement.sql) -- there is no
-- separate Manager/Salesperson role in the schema. "Owner/Admin" below
-- means role = 'admin' (public.is_admin()); "Manager/Salesperson" means any
-- non-admin authenticated staff account, exactly like every other
-- admin-only feature in this app (Inventory Master itself, Staff
-- Management, Business Profile, Branches). Also note branches.id is `text`
-- (e.g. 'abuja', not a uuid -- see 0001_branches.sql), so the branch-scoped
-- RPC below takes p_branch_id text to match, not uuid.

-- ---------------------------------------------------------------------
-- 1. Website fields on products
-- ---------------------------------------------------------------------

alter table public.products add column if not exists brand text;
alter table public.products add column if not exists model text;
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists full_description text;
alter table public.products add column if not exists website_price numeric(14, 2);
alter table public.products add column if not exists website_slug text;
alter table public.products add column if not exists product_image_url text;
alter table public.products add column if not exists gallery_image_urls jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists warranty_text text;
alter table public.products add column if not exists is_visible_on_website boolean not null default false;
alter table public.products add column if not exists is_featured_on_website boolean not null default false;
alter table public.products add column if not exists website_display_order integer not null default 0;
alter table public.products add column if not exists is_combo_eligible boolean not null default false;
alter table public.products add column if not exists calculator_eligible boolean not null default false;

-- website_price: null (not priced for the website yet) or >= 0.
alter table public.products
  add constraint products_website_price_check
  check (website_price is null or website_price >= 0);

-- website_slug: unique when provided. A plain unique constraint already
-- allows any number of NULL rows in Postgres, so "unique when provided" is
-- the constraint's default behaviour, not a special case.
alter table public.products
  add constraint products_website_slug_key unique (website_slug);

alter table public.products
  add constraint products_website_display_order_check
  check (website_display_order >= 0);

alter table public.products
  add constraint products_gallery_image_urls_is_array
  check (jsonb_typeof(gallery_image_urls) = 'array');

alter table public.products
  add constraint products_specifications_is_object
  check (jsonb_typeof(specifications) = 'object');

comment on column public.products.brand is 'Website-facing brand/manufacturer name (e.g. Deye, Felicity). Free text -- see BMS-side suggestion list, not a fixed enum.';
comment on column public.products.category is 'Reused as the website category too. Already free text (see 0003_products.sql) -- BMS suggests Solar Panels/Inverters/Lithium Batteries/Accessories but allows any value.';
comment on column public.products.website_price is 'Public website price. Deliberately separate from cost_price, selling_price (BMS/walk-in), and any future branch-specific price -- see WEBSITE_CATALOGUE_NOTES.md.';
comment on column public.products.gallery_image_urls is 'Ordered JSON array of public Storage URLs (product-images bucket). Never base64.';
comment on column public.products.specifications is 'Free-form JSON object of spec label -> value pairs. Shape intentionally varies by category (inverter/battery/panel) -- see the BMS Specification Editor.';

-- ---------------------------------------------------------------------
-- 2. Safe public catalogue view
-- ---------------------------------------------------------------------
-- Plain view, not security definer, but views execute against their
-- underlying tables as the *view owner* (the migration-running role, which
-- owns public.products and therefore bypasses its RLS policies) rather than
-- as the querying role -- the standard Supabase pattern for exposing a safe
-- slice of an RLS-protected table to anon. Only the columns listed below
-- are reachable through it; cost_price/selling_price/reorder_level/
-- supplier/quantity_in_stock/created_at/updated_at are simply never
-- selected, so there is no way to read them through this view regardless
-- of the caller's role.

create view public.website_catalogue as
select
  p.id,
  p.sku,
  p.name,
  p.brand,
  p.model,
  p.category,
  p.unit,
  p.short_description,
  p.full_description,
  p.website_price,
  p.website_slug,
  p.product_image_url,
  p.gallery_image_urls,
  p.specifications,
  p.warranty_text,
  p.is_featured_on_website,
  p.website_display_order,
  p.is_combo_eligible,
  p.calculator_eligible,
  coalesce(s.total_quantity, 0) as total_stock_quantity,
  case when coalesce(s.total_quantity, 0) > 0 then 'in_stock' else 'out_of_stock' end as stock_status
from public.products p
left join (
  select product_id, sum(quantity) as total_quantity
  from public.product_stock
  group by product_id
) s on s.product_id = p.id
where p.is_active = true and p.is_visible_on_website = true;

-- Anon and authenticated may read the view; neither has (or gains) any
-- direct grant on public.products or public.product_stock themselves.
grant select on public.website_catalogue to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Safe branch-specific catalogue + stock RPC
-- ---------------------------------------------------------------------
-- security definer so anon can call it without ever being granted direct
-- access to product_stock (same rationale as record_sale/
-- record_stock_movement already being definer -- see 0004/0018). Runs as
-- the function owner, so it bypasses RLS the same way the view above does;
-- unlike the view, this needs to be a function because it takes a
-- parameter (the branch) and validates it before returning anything.

create function public.get_website_catalogue_by_branch(p_branch_id text)
returns table (
  id uuid,
  sku text,
  name text,
  brand text,
  model text,
  category text,
  unit text,
  short_description text,
  full_description text,
  website_price numeric,
  website_slug text,
  product_image_url text,
  gallery_image_urls jsonb,
  specifications jsonb,
  warranty_text text,
  is_featured_on_website boolean,
  website_display_order integer,
  is_combo_eligible boolean,
  calculator_eligible boolean,
  branch_id text,
  branch_name text,
  branch_quantity integer,
  branch_stock_status text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_branch_name text;
  v_branch_status text;
begin
  select b.name, b.status into v_branch_name, v_branch_status
    from public.branches b
    where b.id = p_branch_id;

  if not found then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;

  if v_branch_status <> 'active' then
    raise exception 'Branch is not active: %', p_branch_id;
  end if;

  return query
    select
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.model,
      p.category,
      p.unit,
      p.short_description,
      p.full_description,
      p.website_price,
      p.website_slug,
      p.product_image_url,
      p.gallery_image_urls,
      p.specifications,
      p.warranty_text,
      p.is_featured_on_website,
      p.website_display_order,
      p.is_combo_eligible,
      p.calculator_eligible,
      p_branch_id,
      v_branch_name,
      coalesce(ps.quantity, 0),
      case when coalesce(ps.quantity, 0) > 0 then 'in_stock' else 'out_of_stock' end
    from public.products p
    left join public.product_stock ps
      on ps.product_id = p.id and ps.branch_id = p_branch_id
    where p.is_active = true and p.is_visible_on_website = true
    order by p.website_display_order, p.name;
end;
$$;

revoke all on function public.get_website_catalogue_by_branch(text) from public;
revoke all on function public.get_website_catalogue_by_branch(text) from anon;
grant execute on function public.get_website_catalogue_by_branch(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Admin-only website-details update function
-- ---------------------------------------------------------------------
-- Mirrors create_product()/update_product()'s existing is_admin() gate
-- (0022_inventory_admin_only.sql) -- enforced in the database, not just the
-- UI, so a non-admin calling this RPC directly still gets rejected. Full
-- replace semantics (like update_product), not a partial patch: the caller
-- always sends the complete website field set, including images and
-- specifications, so there is exactly one write path for this data and no
-- risk of a partial update silently clobbering fields it didn't intend to
-- touch. Returns only the public/website-facing columns (not the full
-- products row), per spec.

create function public.update_product_website_details(
  p_id uuid,
  p_brand text,
  p_model text,
  p_short_description text,
  p_full_description text,
  p_website_price numeric,
  p_website_slug text,
  p_product_image_url text,
  p_gallery_image_urls jsonb,
  p_specifications jsonb,
  p_warranty_text text,
  p_is_visible_on_website boolean,
  p_is_featured_on_website boolean,
  p_website_display_order integer,
  p_is_combo_eligible boolean,
  p_calculator_eligible boolean
)
returns table (
  id uuid,
  sku text,
  name text,
  brand text,
  model text,
  category text,
  unit text,
  short_description text,
  full_description text,
  website_price numeric,
  website_slug text,
  product_image_url text,
  gallery_image_urls jsonb,
  specifications jsonb,
  warranty_text text,
  is_visible_on_website boolean,
  is_featured_on_website boolean,
  website_display_order integer,
  is_combo_eligible boolean,
  calculator_eligible boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit website details';
  end if;

  if p_website_price is not null and p_website_price < 0 then
    raise exception 'Website price must be zero or greater';
  end if;

  if p_website_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;

  if jsonb_typeof(p_gallery_image_urls) is distinct from 'array' then
    raise exception 'Gallery images must be a JSON array';
  end if;

  if jsonb_typeof(p_specifications) is distinct from 'object' then
    raise exception 'Specifications must be a JSON object';
  end if;

  -- Empty string means "no slug", same convention as supplier/description
  -- optional-text fields elsewhere in this app.
  v_slug := nullif(trim(p_website_slug), '');

  update public.products
    set brand = nullif(trim(p_brand), ''),
        model = nullif(trim(p_model), ''),
        short_description = nullif(trim(p_short_description), ''),
        full_description = nullif(trim(p_full_description), ''),
        website_price = p_website_price,
        website_slug = v_slug,
        product_image_url = nullif(trim(p_product_image_url), ''),
        gallery_image_urls = p_gallery_image_urls,
        specifications = p_specifications,
        warranty_text = nullif(trim(p_warranty_text), ''),
        is_visible_on_website = p_is_visible_on_website,
        is_featured_on_website = p_is_featured_on_website,
        website_display_order = p_website_display_order,
        is_combo_eligible = p_is_combo_eligible,
        calculator_eligible = p_calculator_eligible
    where products.id = p_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  return query
    select
      v_product.id,
      v_product.sku,
      v_product.name,
      v_product.brand,
      v_product.model,
      v_product.category,
      v_product.unit,
      v_product.short_description,
      v_product.full_description,
      v_product.website_price,
      v_product.website_slug,
      v_product.product_image_url,
      v_product.gallery_image_urls,
      v_product.specifications,
      v_product.warranty_text,
      v_product.is_visible_on_website,
      v_product.is_featured_on_website,
      v_product.website_display_order,
      v_product.is_combo_eligible,
      v_product.calculator_eligible,
      v_product.updated_at;
end;
$$;

-- Same pattern as create_product/update_product: not granted to anon at
-- all, only authenticated (the is_admin() check inside then narrows it to
-- admins specifically -- a non-admin authenticated call still reaches the
-- function but is rejected by the raise exception above).
revoke all on function public.update_product_website_details(
  uuid, text, text, text, text, numeric, text, text, jsonb, jsonb, text, boolean, boolean, integer, boolean, boolean
) from public;
revoke all on function public.update_product_website_details(
  uuid, text, text, text, text, numeric, text, text, jsonb, jsonb, text, boolean, boolean, integer, boolean, boolean
) from anon;
grant execute on function public.update_product_website_details(
  uuid, text, text, text, text, numeric, text, text, jsonb, jsonb, text, boolean, boolean, integer, boolean, boolean
) to authenticated;

-- ---------------------------------------------------------------------
-- 5. product-images Storage bucket
-- ---------------------------------------------------------------------
-- Same shape as the `branding` bucket (0020_logo_upload.sql): public read
-- (product photos are meant to be publicly visible, same as the logo),
-- admin-only write. Adds a server-side file-size/type allowlist too
-- (branding didn't need one since only admins ever touched it and only via
-- one hardcoded form) as defence in depth alongside the client-side
-- validation in the upload UI.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read product images"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'product-images');

create policy "Only admins can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Only admins can update product images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Only admins can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
