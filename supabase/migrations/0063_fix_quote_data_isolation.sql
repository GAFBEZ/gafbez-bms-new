-- quote_saved_items and quote_templates are documented (see their own
-- table comments from 0060/0061) as strictly personal, per-owner data --
-- "never shared between owners" -- but their SELECT policies granted any
-- admin blanket read access to every owner's rows regardless of role,
-- directly contradicting that. A BMS admin testing the installer Quote
-- Builder was able to see their own test installer's saved item show up
-- in BMS's "Manage Saved Items" list as a result. There's no legitimate
-- oversight need for a staff admin to browse an installer's scratch
-- line-item library, so the admin bypass is removed outright here.
drop policy "Owners and admins can read saved items" on public.quote_saved_items;
create policy "Owners can read their own saved items"
  on public.quote_saved_items
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy "Owners and admins can read templates" on public.quote_templates;
create policy "Owners can read their own templates"
  on public.quote_templates
  for select
  to authenticated
  using (owner_id = auth.uid());

-- quotes itself represents actual issued documents, where a staff admin
-- reviewing other staff members' issued quotes is a legitimate business
-- need (same reasoning as staff sales/orders oversight elsewhere in
-- BMS) -- but that oversight should stop at the staff/installer
-- boundary, not extend into installers' quotes for their own customers,
-- which is a different app and a different trust boundary entirely.
drop policy "Owners and admins can read quotes" on public.quotes;
create policy "Owners and same-role admins can read quotes"
  on public.quotes
  for select
  to authenticated
  using (owner_id = auth.uid() or (public.is_admin() and owner_role = 'staff'));
