-- Installer feedback: they want to save a reusable line-item + load-calc
-- "starting point" for each system type (Complete Solar System vs.
-- Inverter & Battery Only) so building a new customer's quote is editing
-- a known-good setup instead of typing every line item from scratch.
--
-- Deliberately a separate table from `quotes`, not another row in it:
-- `quotes` is a record of an actual quote issued to an actual customer
-- (quote_number, quote_date, customer_name/address, totals) and already
-- supports update-in-place for editing that one document. A template has
-- no customer and is reused many times, so mixing it into `quotes` would
-- clutter an installer's real quote history with blank scaffolding rows.
-- Same "personal, never shared, insert/select/delete only" shape as
-- quote_saved_items (0060) -- editing a template means loading it into
-- the builder and saving a new one, not updating it in place.

create table public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  system_type text not null check (system_type in ('full_system', 'inverter_only')),
  name text not null,
  line_items jsonb not null default '[]'::jsonb,
  load_calc jsonb,
  created_at timestamptz not null default now()
);

comment on table public.quote_templates is 'An owner''s personal, reusable "starting point" quote (line items + load calculator) per system type, saved once from the Quote Builder and loaded back in on later quotes to avoid re-typing the same items. Never shared between owners, distinct from quotes (which are actual issued customer documents).';

create index quote_templates_owner_id_idx on public.quote_templates (owner_id);

alter table public.quote_templates enable row level security;

create policy "Owners and admins can read templates"
  on public.quote_templates
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "Owners can insert their own templates"
  on public.quote_templates
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can delete their own templates"
  on public.quote_templates
  for delete
  to authenticated
  using (owner_id = auth.uid());

revoke all on public.quote_templates from anon;
grant select, insert, delete on public.quote_templates to authenticated;
