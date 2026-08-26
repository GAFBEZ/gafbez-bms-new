-- Quotation Builder: one engine, two audiences.
--
--  - Staff (BMS, GAFBEZ-branded): build/save quotes using the products
--    table they already have full read/write access to. No new
--    catalogue access needed for them -- this migration adds nothing on
--    that side beyond the shared `quotes` table.
--  - Installers (website, self-branded): gated to customer_profiles rows
--    already approved through the existing installer program
--    (0039_installer_accounts.sql .. 0042_installer_temp_approval.sql).
--    They mark up products.selling_price -- the exact same wholesale
--    price they already pay at checkout -- with their own
--    quote_markup_percent. Never products.cost_price, and never a new
--    separate installer-only price tier: these are the same vetted
--    installers who already see selling_price at checkout, so reusing it
--    here isn't a new exposure, just a second place the number they
--    already know gets used.
--
-- No new installer identity table: quote-builder branding fields live
-- directly on customer_profiles, the same row the installer program
-- already reviews and approves.

-- ---------------------------------------------------------------------
-- 1. customer_profiles: quote-builder branding fields
-- ---------------------------------------------------------------------
-- Populated once by the installer, editable anytime. Meaningful only
-- once installer_status is 'approved' or 'temp_approved' -- that's
-- enforced by get_installer_catalogue() below and by the website UI,
-- not by a constraint here. A still-'pending' applicant filling these in
-- early is harmless: the fields just sit inert until they're approved.

alter table public.customer_profiles
  add column quote_logo_url text,
  add column quote_tagline text,
  add column quote_services_line text,
  add column quote_markup_percent numeric not null default 0,
  add column quote_payment_details text,
  add column quote_terms_and_warranty text;

alter table public.customer_profiles
  add constraint customer_profiles_quote_markup_percent_check
  check (quote_markup_percent >= 0);

comment on column public.customer_profiles.quote_logo_url is 'Installer''s own logo for their branded printed quotes (Storage: installer-logos bucket, path {auth.uid()}/...). Not used by the GAFBEZ staff quote builder, which is hardcoded to the GAFBEZ logo.';
comment on column public.customer_profiles.quote_markup_percent is 'Installer-set percentage applied on top of products.selling_price when building a quote. The printed quote only ever shows the marked-up price -- selling_price itself is never rendered.';

-- ---------------------------------------------------------------------
-- 2. quotes table -- shared by staff and installers
-- ---------------------------------------------------------------------

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  owner_role text not null check (owner_role in ('staff', 'installer')),
  system_type text not null check (system_type in ('full_system', 'inverter_only')),
  quote_number text,
  quote_date date not null default current_date,
  customer_name text,
  customer_address text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  vat_percent numeric not null default 0,
  grand_total numeric not null default 0,
  load_calc jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.quotes is 'Saved quotations from both the staff (BMS) and installer (website) quote builders. owner_role records which builder created it so each UI can list "my quotes" without a join. line_items/load_calc are jsonb since their shape is UI-owned, not something the database validates line-by-line.';

create index quotes_owner_id_idx on public.quotes (owner_id);

alter table public.quotes enable row level security;

-- Admins can see every quote (staff and installer) for support/audit,
-- same "admin sees everything" convention as every other feature in this
-- schema. Everyone else -- staff or installer -- only ever sees their own.
create policy "Owners and admins can read quotes"
  on public.quotes
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "Owners can insert their own quotes"
  on public.quotes
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their own quotes"
  on public.quotes
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their own quotes"
  on public.quotes
  for delete
  to authenticated
  using (owner_id = auth.uid());

revoke all on public.quotes from anon;
grant select, insert, update, delete on public.quotes to authenticated;

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. installer-logos storage bucket
-- ---------------------------------------------------------------------
-- Public read (logos aren't sensitive -- installers want theirs seen),
-- owner-only write, one folder per installer keyed by their own
-- auth.uid() so an installer can never touch another's file even if
-- they guessed its path. Same public/size/mime-limit shape as the
-- existing product-images bucket (0028_website_catalogue.sql).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'installer-logos',
  'installer-logos',
  true,
  512000, -- 500 KB (client compresses to well under this before upload)
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can read installer logos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'installer-logos');

create policy "Installers can upload their own logo"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'installer-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Installers can update their own logo"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'installer-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'installer-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Installers can delete their own logo"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'installer-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 4. get_installer_catalogue() -- the only way the website's installer
--    quote builder ever sees a price. Mirrors
--    get_website_catalogue_by_branch() (0028_website_catalogue.sql):
--    security definer, checked internally, callable only by
--    authenticated. Unlike that function, this one is not branch-scoped
--    -- the quote builder is a paper/PDF tool, not a live-stock
--    checkout, so branch-level stock quantity isn't part of its contract.
-- ---------------------------------------------------------------------

create function public.get_installer_catalogue()
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
  select * into v_customer
    from public.customer_profiles
    where id = auth.uid();

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

revoke all on function public.get_installer_catalogue() from public;
revoke all on function public.get_installer_catalogue() from anon;
grant execute on function public.get_installer_catalogue() to authenticated;

comment on function public.get_installer_catalogue() is 'The only path the website''s installer quote builder has to any product price. Returns products.selling_price (aliased price) -- the same wholesale number an approved/temp_approved installer already pays at checkout -- and nothing from cost_price. Raises for anyone not currently eligible, so a non-installer or expired temp_approved caller gets an error, not an empty/wrong-priced list.';
