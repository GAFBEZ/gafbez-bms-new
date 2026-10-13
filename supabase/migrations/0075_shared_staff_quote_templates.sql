-- Request: a template saved by one BMS staff member (e.g. admin) should
-- be visible to every other staff member too, not just its own owner --
-- unlike quote_saved_items, which stays strictly personal scratch data.
--
-- quote_templates is shared with the installer-facing website (same
-- table, see gafbeznewweb's customer-account Quote Builder), so this
-- can't simply become "any authenticated user can read any template" --
-- that would leak installers' own templates to BMS staff and vice versa,
-- the exact cross-trust-boundary leak 0063 already fixed once for this
-- table. Scope the new read access to "both rows belong to BMS staff"
-- instead, using is_staff() (true only for rows in public.profiles,
-- which installers never have) on both the caller and the template's
-- owner.
drop policy "Owners can read their own templates" on public.quote_templates;

create policy "Staff can read any staff-owned template"
  on public.quote_templates
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      public.is_staff()
      and exists (select 1 from public.profiles p where p.id = quote_templates.owner_id)
    )
  );

-- Insert/delete stay owner-only -- unchanged from 0061/0063: everyone can
-- still only create their own templates and delete their own, just not
-- read-only browse everyone else's now.
