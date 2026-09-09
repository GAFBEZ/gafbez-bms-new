-- Invoice / Receipt Builder: a second document type alongside quotes,
-- built freestanding (not converted from a saved quote -- not every
-- quote turns into a paid job) but saved and reopenable, since a real
-- invoice gets revisited over its life to log the balance payment weeks
-- after the deposit. Same owner_id/owner_role shape as `quotes`
-- (0057_quote_builder.sql) so both apps can list "my invoices" the same
-- way they already list "my quotes" -- and using the RLS shape quotes
-- itself only reached after 0063_fix_quote_data_isolation.sql, not the
-- original admin-sees-everyone version, so this table starts out
-- correct rather than needing its own later fix.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_role text not null check (owner_role in ('staff', 'installer')),
  system_type text not null check (system_type in ('full_system', 'inverter_only')),
  invoice_number text,
  invoice_date date not null default current_date,
  client_name text,
  project_location text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  vat_percent numeric not null default 0,
  total numeric not null default 0,
  deposit_percent numeric not null default 70,
  payments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoices is 'Saved invoices/receipts from both the staff (BMS) and installer (website) Invoice Builders -- same owner_id/owner_role convention as public.quotes. line_items/payments are jsonb since their shape is UI-owned: line_items is {id,label,quantity,unitPrice}[] (label stored per row, not re-derived from system_type, so an already-saved invoice keeps its original wording even if the category list changes later), payments is {id,date,amount,method,reference}[], appended to over the document''s life as each payment comes in.';
comment on column public.invoices.deposit_percent is 'Editable per invoice, defaults to 70 -- the remaining balance is just 100 minus this, not a separately stored figure.';

create index invoices_owner_id_idx on public.invoices (owner_id);

alter table public.invoices enable row level security;

create policy "Owners and same-role admins can read invoices"
  on public.invoices
  for select
  to authenticated
  using (owner_id = auth.uid() or (public.is_admin() and owner_role = 'staff'));

create policy "Owners can insert their own invoices"
  on public.invoices
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their own invoices"
  on public.invoices
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their own invoices"
  on public.invoices
  for delete
  to authenticated
  using (owner_id = auth.uid());

revoke all on public.invoices from anon;
grant select, insert, update, delete on public.invoices to authenticated;

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Payment Terms branding field -- separate from quote_terms_and_warranty
-- (product/workmanship warranty) since this covers the deposit/balance
-- payment policy instead, a different concern editable independently.
-- ---------------------------------------------------------------------

alter table public.app_settings
  add column invoice_payment_terms text;

comment on column public.app_settings.invoice_payment_terms is 'Free-text payment-terms paragraph (deposit/balance policy) shown on printed staff invoices/receipts. Separate from quote_terms_and_warranty.';

alter table public.customer_profiles
  add column invoice_payment_terms text;

comment on column public.customer_profiles.invoice_payment_terms is 'Free-text payment-terms paragraph (deposit/balance policy) shown on an installer''s printed invoices/receipts. Separate from quote_terms_and_warranty.';

-- Extend the installer's existing SECURITY DEFINER branding-write path
-- with a defaulted trailing parameter. Note the function is already at
-- 7 arguments as of 0060_quote_footer_and_saved_items.sql (which added
-- p_footer_details) -- not the original 6 from 0058 -- so it's *that*
-- signature that must be dropped here, and p_footer_details must be
-- carried forward into the new version, or footer-details support would
-- silently regress. CREATE OR REPLACE FUNCTION treats a changed argument
-- list as a distinct overload rather than replacing the old one in
-- place, so the previous version is dropped explicitly first -- without
-- this, both versions would exist afterward and any call site still
-- using the old 7-argument form would silently keep writing
-- invoice_payment_terms as null forever.
drop function if exists public.update_installer_quote_branding(text, text, text, numeric, text, text, text);

create function public.update_installer_quote_branding(
  p_logo_url text,
  p_tagline text,
  p_services_line text,
  p_markup_percent numeric,
  p_payment_details text,
  p_terms_and_warranty text,
  p_footer_details text,
  p_invoice_payment_terms text default null
)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_profile public.customer_profiles;
begin
  if v_customer_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_markup_percent is null or p_markup_percent < 0 then
    raise exception 'Markup percent must be zero or greater';
  end if;

  update public.customer_profiles
    set quote_logo_url = nullif(btrim(p_logo_url), ''),
        quote_tagline = nullif(btrim(p_tagline), ''),
        quote_services_line = nullif(btrim(p_services_line), ''),
        quote_markup_percent = p_markup_percent,
        quote_payment_details = nullif(btrim(p_payment_details), ''),
        quote_terms_and_warranty = nullif(btrim(p_terms_and_warranty), ''),
        quote_footer_details = nullif(btrim(p_footer_details), ''),
        invoice_payment_terms = nullif(btrim(coalesce(p_invoice_payment_terms, '')), '')
    where id = v_customer_id
    returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text, text) from public;
revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text, text) from anon;
grant execute on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text, text) to authenticated;
