-- Staff need to browse the general list of website self-registered
-- accounts (customer_profiles), not just installer applicants (0042) or
-- store-credit holders (storeCredit.ts) -- there was previously no BMS
-- page at all for a plain website customer directory, so a customer who
-- registered and even placed an order but wasn't an installer and had no
-- store credit was invisible to staff outside of opening their specific
-- order. Made staff-wide (not admin-only), matching the existing
-- "Customers" page's access level for comparable PII (name/phone/email)
-- -- see src/app/dashboard/customers/page.tsx, which has no role gate at
-- all beyond being signed-in staff.
--
-- This supersedes 0042's narrower "Trusted staff can read installer
-- applications" policy (scoped to installer_status <> 'none' only) --
-- every staff member can now read every customer_profiles row anyway, so
-- that narrower policy is redundant and is dropped.

drop policy if exists "Trusted staff can read installer applications" on public.customer_profiles;

create policy "Staff can read customer profiles"
  on public.customer_profiles
  for select
  to authenticated
  using (public.is_staff());
