# GAFBEZ Business Management System (gafbez-bms)

## Project Purpose

`gafbez-bms` is the foundation of a secure, internal Business Management
System for **GAFBEZ Energies Ltd**, a renewable energy business operating
across multiple branches in Nigeria. The system will eventually manage
inventory, sales, expenses, customers, staff, documents, and reporting for
the business, with support for working offline in areas with unreliable
connectivity.

This repository currently contains the project foundation, a Supabase
database connection, real staff authentication, and working Inventory
Master, Stock Movement, Customers, Daily Sales, Sales Tracker, Expenses,
Sales Catalogue, Notifications, Documents, Staff Management, Settings,
and My Account modules: the application shell, branding, navigation,
thirteen live tables (`branches`, `profiles`, `products`, `product_stock`,
`stock_movements`, `customers`, `sales`, `sale_items`, `sale_returns`,
`expenses`, `notifications`, `documents`, `app_settings`), and one Supabase Storage
bucket (`documents`, private). A global branch filter in the header
scopes Customers, Stock Movement, Daily Sales, Expenses, Documents,
Inventory Master, and Sales Catalogue to one branch at a time (Sales
Tracker's branch comparison deliberately ignores it — see below). Role enforcement restricts deleting records,
managing staff, changing system-wide defaults, and managing branches to
admins (see "Role enforcement", "Staff Management", "Settings & Dark
Mode", and "Branch Management" below) — everything else, including
managing your own profile and password (see "My Account" below), is open
to any signed-in staff member. Every dashboard card and section is now
backed by live data, and every module (including the sidebar chrome and
login page) supports a light/dark theme. Every planned sidebar module now
has a real implementation — there are no remaining placeholder screens.

## Technology Used

- [Next.js](https://nextjs.org) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [ESLint](https://eslint.org/) (flat config, via `eslint-config-next`)
- [lucide-react](https://lucide.dev/) for icons
- [Supabase](https://supabase.com/) (`@supabase/supabase-js`, `@supabase/ssr`)
  for the database
- npm as the package manager

The codebase keeps route logic, presentational components, shared types
(`src/types`), and data access (`src/lib`) separated, so each future module
(inventory, sales, expenses, etc.) can be added behind the existing
Supabase clients and auth layer without restructuring the app.

## Installation Instructions

1. Ensure Node.js 20.9+ and npm are installed.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   URL and anon/publishable key (Project Settings → API in the Supabase
   dashboard):

   ```bash
   cp .env.example .env.local
   ```

## Database Setup (Supabase)

This project uses [Supabase](https://supabase.com/) as its database. SQL
migrations live in `supabase/migrations/` and are applied manually via the
Supabase dashboard's **SQL Editor** for now (no Supabase CLI project link is
set up yet).

To set up a fresh Supabase project for this app:

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the Project URL and anon/public key into `.env.local` (see above).
3. Open **SQL Editor** in the Supabase dashboard and run each file in
   `supabase/migrations/` in order:
   - `0001_branches.sql` — the branches table.
   - `0002_profiles.sql` — the staff profiles table, RLS policies, and the
     trigger that auto-creates a profile row for every new auth user.
   - `0003_products.sql` — the product catalog table (Inventory Master),
     RLS policies, an `updated_at` trigger, and 5 seeded sample products.
   - `0004_stock_movements.sql` — the append-only stock movement ledger
     (Stock Movement) and the `record_stock_movement()` function that
     atomically adjusts a product's stock and logs the movement.
   - `0005_customers.sql` — the customer table (Customers), RLS policies,
     and 4 seeded sample customers.
   - `0006_sales.sql` — the `sales`/`sale_items` tables (Daily Sales) and
     the `record_sale()` function: atomically deducts stock per line item,
     logs a matching `stock_movements` row per item, and tops up the
     customer's `outstanding_balance` if underpaid.
   - `0007_expenses.sql` — the expenses table (Expenses), RLS policies, and
     5 seeded sample expenses. Plain CRUD, no RPC function — unlike Stock
     Movement/Daily Sales, an expense doesn't drive any atomic downstream
     update, so there's no need for the append-only/transaction pattern.
   - `0008_role_enforcement.sql` — the `is_admin()` helper function and
     tightened DELETE policies on `products`, `customers`, and `expenses`
     (admin-only). See "Role enforcement" below.
   - `0009_notifications.sql` — the notifications table (a shared,
     company-wide notice board, not a per-user inbox — see the migration's
     comments) and 3 seeded sample notifications.
   - `0010_documents.sql` — a private `documents` Storage bucket, its
     Storage RLS policies, and a `documents` metadata table (also RLS'd).
     Depends on `is_admin()` from `0008`, since deleting a document is
     admin-only. See "Documents & Storage" below.
   - `0011_staff_management.sql` — adds `email`/`is_active` columns to
     `profiles`, backfills `email` from `auth.users` for any profiles
     created before this migration, lets admins read/update every
     profile (not just their own), and adds a trigger that blocks
     non-admins from changing `role`/`branch_id`/`is_active` on any
     profile including their own. See "Staff Management" below.
   - `0012_app_settings.sql` — a singleton `app_settings` table (the
     boolean primary key can only ever be `true`, so at most one row can
     exist) holding system-wide defaults, currently just
     `default_reorder_level`. Readable by any signed-in user, writable by
     admins only. See "Settings & Dark Mode" below.
   - `0013_branch_management.sql` — tightens the original `branches` SELECT
     policy (was readable by `anon`, a leftover from before staff auth
     existed) to `authenticated` only, and adds admin-only INSERT/UPDATE
     policies. See "Branch Management" below.
   - `0014_sale_profit_tracking.sql` — adds `unit_cost` to `sale_items`,
     backfills it on existing rows using each product's current
     `cost_price` (an approximation — see "Profit Tracking" below), and
     replaces `record_sale()` with an otherwise-identical version that
     captures `unit_cost` at insert time.
   - `0015_returns.sql` — a `sale_returns` table and the `record_return()`
     function: atomically restocks a returned quantity, logs a matching
     `stock_movements` "in" row, and credits the customer's
     `outstanding_balance` (floored at zero). See "Returns" below.
   - `0016_low_stock_notifications.sql` — replaces `record_stock_movement()`
     and `record_sale()` with versions that post an automatic "warning"
     notification the moment a product's stock crosses at-or-below its
     `reorder_level`. See "Low-Stock Notifications" below.
   - `0017_product_stock_audit.sql` — adds `create_product()`/
     `update_product()` functions and switches Inventory Master's Add/Edit
     Product actions to call them instead of a plain insert/update, so
     setting or correcting a product's quantity from Inventory Master logs
     a `stock_movements` row too. See "Product Stock Audit Trail" below.
     (`update_product()`'s quantity-editing capability is superseded by
     `0018` below.)
   - `0018_per_branch_stock.sql` — adds a `product_stock` table (real
     per-branch stock) and turns `products.quantity_in_stock` into a
     trigger-maintained cache of it; rewrites `record_stock_movement()`,
     `record_sale()`, `record_return()`, `create_product()`, and
     `update_product()` to read/write `product_stock` instead of the old
     single aggregate; and backfills existing stock by replaying
     `stock_movements` history per branch. See "Per-Branch Stock" below —
     **read this one before running it**, since it changes what
     "insufficient stock" means and drops a field from Edit Product.
   - `0019_business_profile.sql` — adds `business_name`/`business_address`/
     `business_phone`/`business_email` to `app_settings`, plus an `anon`
     read policy (alongside the existing authenticated-only one) since the
     login page needs to read it before sign-in. See "Business Profile"
     below.
   - `0020_logo_upload.sql` — a public `branding` Storage bucket (admin-only
     write, same `is_admin()` pattern as documents), and `app_settings.logo_path`.
     See "Logo Upload" below.
   - `0021_staff_attribution.sql` — a narrow `get_staff_names()` function
     (id + full name only, nothing sensitive) that any signed-in user can
     call, used to resolve `created_by` to a name on Stock Movement, Daily
     Sales, and Expenses. See "Staff Attribution" below.
   - `0022_inventory_admin_only.sql` — adds an `is_admin()` check inside
     `create_product()`/`update_product()`, so Inventory Master's
     database-level access matches its now admin-only UI. See
     "Role-Based Visibility (Cost & Profit)" below.
   - `0023_branch_locked_staff.sql` — adds a branch check inside
     `record_sale()`/`record_stock_movement()`: a non-admin with an
     assigned branch (`profiles.branch_id`) can only record either at that
     branch. See "Branch-Locked Staff" below.
   - `0024_product_supplier.sql` — adds a `supplier` column to `products`
     and a matching `p_supplier` parameter to `create_product()`/
     `update_product()` (a signature change, so both are dropped and
     recreated with fresh grants, same technique as `update_product()`'s
     rewrite in `0018_per_branch_stock.sql`). See "Supplier, Profit
     Margin & Reorder Level" below.
4. Create your first staff account: **Authentication → Users → Add user →
   Create new user** in the Supabase dashboard (check "Auto Confirm User").
   This app has no public sign-up — staff accounts are provisioned this way,
   not self-registered.

Supabase client utilities live in `src/lib/supabase/`:

- `client.ts` — browser client, for use in Client Components.
- `server.ts` — server client, for use in Server Components, Server
  Actions, and Route Handlers. Reads/writes auth cookies via
  `next/headers`.

`src/proxy.ts` refreshes the auth session on every request and enforces
route protection: signed-out visitors hitting `/dashboard/*` are redirected
to `/login`, and signed-in visitors hitting `/login` are redirected to
`/dashboard`.

`src/lib/auth.ts` exports `getCurrentUser()`, which verifies the session via
`getClaims()` (not `getSession()`, which trusts the cookie without
verifying it) and joins it with the `profiles` table.

**Global branch filter:** the branch dropdown in the header
(`BranchSelector`) is a real filter, not decorative. Selecting a branch
calls the `setActiveBranch` Server Action (`src/app/dashboard/actions.ts`),
which persists the choice in a cookie, then `router.refresh()`s so Server
Components re-fetch scoped to it. `src/lib/activeBranch.ts` exports
`getActiveBranchId()` for any page that wants to read the current
selection — **until a user picks a branch explicitly, it now defaults to
their own assigned branch** (`profiles.branch_id`) instead of "All
Branches," so a staff member's dashboard opens scoped to their own
location right after logging in. See "Branch-Locked Staff" below. Pages
backed by a table with a real `branch_id` column
(Customers, Stock Movement, Daily Sales, Expenses, Documents) filter by
it directly. Inventory Master and Sales Catalogue filter too, but
differently: `getProducts(branchId)` (`src/lib/products.ts`) returns each
product's real per-branch quantity from `product_stock` when a specific
branch is selected, or the company-wide aggregate under "All Branches" —
see "Per-Branch Stock" below. Sales Tracker's "Sales by Branch" chart is a
deliberate exception: it always aggregates every branch regardless of the
header filter, since cross-branch comparison is the whole point of that
chart — scoping it to one branch would leave a single trivial bar.

**Role enforcement:** started narrow — only **deleting** `products`,
`customers`, or `expenses` requires `profiles.role = 'admin'`, enforced at
the RLS level via a `public.is_admin()` helper function (see
`0008_role_enforcement.sql`) and mirrored in the UI (the delete button
simply isn't rendered for non-admins, in `ProductTable`/`CustomerTable`/
`ExpenseTable`). Creating/editing customers and expenses, recording sales,
and recording stock movements stay open to every signed-in staff member —
that's normal day-to-day work, not something that needs gatekeeping.
**Inventory Master (all of it — view, create, edit) became admin-only
later** (see "Role-Based Visibility (Cost & Profit)" below), since cost
price lives there; that's the one exception to "day-to-day work stays
open." `is_admin()` is `SECURITY INVOKER` (the default, no elevated
privilege), not `DEFINER` — it only reads the *calling* user's own
`profiles` row, which they can already read under the existing "Users can
read their own profile" policy, so there's no privilege to escalate.
Promote a user to admin from the Staff Management page (see below) — no
more need to edit the Table Editor directly.

**Staff Management:** deliberately built **without** the Supabase
`service_role` secret key. A leaked `service_role` key bypasses RLS
entirely, and this app never wants to hold one. The tradeoff: account
creation (email + password) still happens in the Supabase Dashboard under
**Authentication → Users → Add user**, not in-app — see the Database Setup
step above. Once a login exists, everything else is managed from
`/dashboard/staff-management` (admin-only, hidden from the sidebar for
non-admins):

- Set a staff member's name, branch, and role (admin/staff). Branch
  assignment now has real teeth — see "Branch-Locked Staff" below.
- Toggle a staff member's `is_active` flag off to deactivate them —
  checked at sign-in (`src/app/login/actions.ts`), so a deactivated
  account can no longer log in. **Known limitation:** this isn't rechecked
  mid-session, so a session already open at the moment of deactivation
  stays valid until it naturally expires, rather than being killed
  instantly. Acceptable for a small internal team; would need a per-request
  check in `src/proxy.ts` (extra DB round-trip on every navigation) if
  instant revocation ever becomes a requirement.
- An admin can't demote or deactivate **themselves** through the UI (the
  `updateStaffMember` Server Action rejects it) — a guardrail against
  accidentally locking out the only admin account. This is an
  application-level check, not an RLS one; it's not a security boundary
  (the requesting user is still legitimately updating a row they're
  allowed to touch), just a footgun guard.
- While building this, found that the original "Users can update their
  own profile" policy (`0002_profiles.sql`) had no `WITH CHECK` clause, so
  Postgres reused its `USING` clause (`auth.uid() = id`) for both reads
  and writes — meaning any signed-in staff member could already call the
  API directly and set their own `role` to `admin`. `0011_staff_management.sql`
  closes this with a trigger (`prevent_profile_privilege_escalation`) that
  blocks changes to `role`/`branch_id`/`is_active` unless the caller is an
  admin, regardless of which RLS policy the request matched.
- `profiles.email` is populated by `handle_new_user()` at account-creation
  time (from `auth.users.email`, available inside that trigger) so the
  staff list can show it — the app itself never queries `auth.users`
  directly, since that table isn't exposed to the `authenticated` role.

**Documents & Storage:** the `documents` Storage bucket is **private**
(`public = false` in `storage.buckets`) — nothing is reachable via a
guessable public URL. Downloads go through
`getDocumentDownloadUrl()`/`requestDownloadUrl()`
(`src/lib/documents.ts`, `src/app/dashboard/documents/actions.ts`), which
call `createSignedUrl()` on demand with a 60-second expiry, generated only
when someone actually clicks Download. Storage access itself is governed
by RLS policies on `storage.objects` (a separate policy surface from
regular tables — see `0010_documents.sql`), scoped by `bucket_id`;
`uploadDocument()` writes the file to Storage first and only inserts the
`documents` metadata row if that succeeds, deleting the orphaned Storage
object if the metadata insert fails, so a partial failure can't leave an
untracked file. Deleting a document (both the Storage object and its
metadata row) is admin-only, consistent with delete everywhere else in
this app.

**Settings & Dark Mode:** `/dashboard/settings` has several independent
sections:

- **Appearance** (everyone): Light/Dark/System, stored in a `theme`
  cookie via `setThemePreference()` (`src/app/dashboard/settings/actions.ts`).
  Deliberately **per device/browser, not per account** — no
  `profiles` column for it, no sync across devices. Simpler, and
  matches how the global branch filter already works (also a plain
  cookie). Applying "System" means reading the OS's
  `prefers-color-scheme` at the moment it's selected, not living updates
  if the OS preference changes later while the tab is open.
- **Business Profile** (admin-only): company name, address, phone, and
  email, plus a logo upload — see "Business Profile" and "Logo Upload"
  below.
- **Inventory Defaults** (admin-only): currently just
  `default_reorder_level`, pre-filled (but not enforced — it stays an
  editable number, not a floor) on the Add Product form. Read via
  `getAppSettings()` (`src/lib/settings.ts`), which falls back to `5` if
  the table isn't reachable, same pattern as `getBranches()`.

**How dark mode avoids a flash on load:** Tailwind v4 defaults its `dark:`
variant to `prefers-color-scheme`, which can't be overridden by a manual
toggle. `globals.css` redefines it with
`@custom-variant dark (&:where(.dark, .dark *));`, so `dark:` classes
apply whenever an ancestor has `class="dark"` instead. That class is set
by a blocking inline `<script>` in `src/app/layout.tsx`'s `<head>` (reads
the `theme` cookie directly, since it must run before React hydrates) —
not by a server-rendered class, since "System" can't be resolved on the
server without a User-Agent Client Hint most browsers don't send.
`<html suppressHydrationWarning>` stops React from complaining that the
script mutated the DOM before hydration; this is a deliberate, narrow
suppression (one attribute, one element), not a blanket one.

**Applying dark mode across ~60 existing files:** rather than hand-editing
every component, a one-off script (not checked into the repo) walked
every `.tsx` file and appended a `dark:` sibling class immediately after
each occurrence of a known light-mode utility (e.g. every bare
`text-gray-900` got `dark:text-gray-100` appended right after it), using
regex boundaries so `hover:bg-gray-50` and `bg-gray-500` couldn't
collide with the bare `bg-gray-50` rule. `bg-white`/`text-white` on
elements that are *already* a solid color fill regardless of theme
(sidebar, primary buttons, the full-color dashboard metric cards, the
logo mark) were deliberately left alone — those aren't neutral surfaces
that should invert, they're brand-colored fills with white text on top
in both themes. The `brand-green-soft`/`brand-gold-soft` pale badge
tints get their dark values from a `.dark { --color-brand-green-soft: …
}` override in `globals.css` instead of a per-class `dark:` suffix,
since they're already CSS custom properties.

**Branch Management:** a third Settings section, admin-only. Add a branch
(`src/app/dashboard/settings/branches/new`) or edit an existing one's
name/status (`src/app/dashboard/settings/branches/[id]/edit`), both
sharing `BranchForm` and going through `createBranch()`/`updateBranch()`
(`src/app/dashboard/settings/branches/actions.ts`). A new branch's `id`
is slugified from its name (`"GAFBEZ Energies Kano Branch"` →
`"gafbez-energies-kano-branch"`) server-side and is then immutable — it's
referenced by `branch_id` across `stock_movements`, `sales`, `customers`,
`expenses`, `documents`, and `profiles`, so renaming would silently break
those links. For the same reason there's **no delete**: setting a branch
to "Coming Soon" (via the same status field the seed data already used
for Ilorin) is the supported way to retire one — it stays selectable in
historical records but disappears as a pickable option in forms. While
building this, found that `0001_branches.sql`'s original SELECT policy
granted read access to `anon` (unauthenticated) — noted at the time as
temporary ("will be tightened once staff accounts and roles exist") but
never actually revisited. Nothing in the app relied on it (the branch
selector only ever renders inside the authenticated dashboard), so
`0013_branch_management.sql` closes it alongside adding the admin-only
write policies.

**My Account:** `/dashboard/account`, open to every signed-in user (not
admin-gated), reachable by clicking your name/avatar in the header. Two
independent things, neither needing a new migration since both reuse
existing infrastructure:

- **Profile** — edit your own `full_name` via `updateOwnProfile()`
  (`src/app/dashboard/account/actions.ts`). Works under the existing
  "Users can update their own profile" RLS policy from `0002_profiles.sql`
  — email, role, and branch are shown read-only here and can only be
  changed by an admin from Staff Management, enforced by the
  `prevent_profile_privilege_escalation` trigger from
  `0011_staff_management.sql` (see "Staff Management" above).
- **Change Password** — calls `supabase.auth.updateUser({ password })`,
  which needs no SMTP/email setup at all (unlike a "forgot password"
  reset-link flow, this only works for an already-authenticated session,
  which is exactly the case here). Before calling it,
  `changePassword()` re-verifies the current password via a fresh
  `signInWithPassword()` call — Supabase's API doesn't require this for
  an authenticated session, but skipping it would mean anyone who found a
  staff member's computer unlocked could silently lock them out by
  "changing" a password they don't actually know.

**Profit Tracking:** before `0014_sale_profit_tracking.sql`, `sale_items`
recorded `unit_price` (what the customer paid) but not what the product
cost — so the dashboard's "Net Profit" card was quietly computing
`total sales − total expenses`, which isn't net profit at all (it ignores
cost of goods sold, and overstates profit by the full margin on every
sale). Fixed by adding `sale_items.unit_cost`, captured automatically
inside `record_sale()` from the product's `cost_price` at the moment of
sale — no client-supplied cost, so it can't be spoofed from the browser.
`getSalesSummary()` (`src/lib/salesTracker.ts`) now also returns
`totalCogs`/`grossProfit`, and `getLiveNetProfit()`
(`src/lib/dashboard.ts`) is now `(revenue − COGS) − expenses`. Two
caveats:

- **Pre-existing sales** had their `unit_cost` backfilled using each
  product's *current* `cost_price`, since the actual cost at the time of
  each historical sale isn't recoverable. Profit figures that include
  sales from before this migration are an approximation for that portion,
  not exact.
- This is distinct from the dashboard's **"Estimated Gross Profit"** card,
  which was already accurate for what it claims — potential margin on
  *current inventory* (`expected revenue − inventory value` at cost, from
  `getLiveInventoryDashboardData()`), not realized margin on actual sales.
  The two cards answer different questions and will normally show
  different numbers.

Modifying `record_sale()` — a function every sale has gone through since
Daily Sales launched — was done as a minimal, additive change: the new
version is a like-for-like copy of the original (same insufficient-stock
guard, same two-pass validate-then-write structure, same
`stock_movements`/`outstanding_balance` side effects) with only the
`unit_cost` capture added. `CREATE OR REPLACE FUNCTION` preserves the
function's OID, so the `anon`-revoke/`authenticated`-grant from
`0006_sales.sql` (see the gotcha below) carried over automatically —
re-verified with an anon-key script rather than assumed.

**Returns:** `/dashboard/daily-sales/[id]` (reachable via a new "view" icon
on each row in the Daily Sales list) shows a sale's line items and lets any
signed-in staff member return part or all of an item's quantity —
**line-item, partial returns**, not just "cancel the whole sale." Backed by
a new `sale_returns` table (`0015_returns.sql`) and a
`record_return(p_sale_item_id, p_quantity, p_reason)` `SECURITY DEFINER`
function that, in one transaction:

1. Checks the requested quantity, added to any quantity already returned
   for that line item, doesn't exceed what was actually sold (rejects the
   whole return otherwise — never a partial one).
2. Inserts the `sale_returns` row.
3. Adds the quantity back to `products.quantity_in_stock` and logs a
   matching `stock_movements` "in" row (reason `"Return: Sale <id>"`), so
   returns stay visible in the same audit trail as every other stock
   change.
4. If the sale was linked to a customer, credits their
   `outstanding_balance` by the returned line value, **floored at zero**
   (`greatest(0, outstanding_balance - value)`) — a return can't push a
   balance negative, since `outstanding_balance` only ever tracks money
   still owed, not credit owed back to the customer.

This is **full accounting**, not just a restock: `getSalesSummary()`
(`src/lib/salesTracker.ts`) nets returns out of both Total Sales and Gross
Profit via a new `fetchReturns()` query, joined `sale_returns → sale_items
→ sales` so a return is attributed to its *original sale's* date rather
than the date it was processed. Transaction count, Average Sale, and the
"Sales by Branch"/"Daily Sales Trend" charts deliberately stay gross — a
return isn't a new transaction, and an activity view is normal to report
gross. `sale_returns` RLS is open to every `authenticated` user, matching
the philosophy already used for `sales`/`stock_movements` (day-to-day
recording work, not something that needs gatekeeping); `record_return()`
follows the same `anon`-revoke/`authenticated`-grant pattern as every other
privileged function here, re-verified with an anon-key script.

**Low-Stock Notifications:** `0016_low_stock_notifications.sql` replaces
`record_stock_movement()` and `record_sale()` with versions that post an
automatic `'warning'` row to `notifications` the moment a product's
`quantity_in_stock` crosses at-or-below its `reorder_level` — closing the
gap the Notifications module originally shipped with (see
`0009_notifications.sql`'s comments and the "Notifications" bullet below).
Deliberately fires only on the **crossing**: the check compares the
quantity *before* this deduction (still above `reorder_level`) against the
quantity *after* (now at or below it), not just "is it currently low" —
otherwise a popular low-stock item would post a fresh notification on
every single subsequent sale while it stays low. Restocking (`'in'`
movements, and `record_return()`) only ever raises stock, so neither
needs the check. `created_by` is left `null` on these rows, unlike a
manually-posted notification (which records `auth.uid()` in the Server
Action) — a system-generated alert is distinguishable from a staff post if
that ever matters later. No frontend changes were needed: the existing
`getNotifications()`/unread-count queries don't filter by `created_by`, so
these rows surface through the header bell and Notifications page exactly
like a manual post.

**Product Stock Audit Trail:** before `0017_product_stock_audit.sql`,
Inventory Master's Add/Edit Product form set `quantity_in_stock` with a
plain insert/update — the only remaining path in the app that changed
stock without a matching `stock_movements` row (every other path —
`record_sale()`, `record_stock_movement()`, `record_return()` — already
logged atomically). Closed by two new functions that Add/Edit Product
called instead: `create_product(...)`, which — given a nonzero starting
quantity — logged it as an `'in'` movement reasoned `"Initial stock (new
product)"`; and `update_product(...)`, which logged any change to the
quantity field as a `'in'`/`'out'` movement reasoned `"Manual correction
(Inventory Master edit)"`. At the time, products weren't branch-scoped
(`quantity_in_stock` was a single company-wide aggregate), so both
functions took a branch purely to attribute the movement to one for
reporting. **`update_product()`'s quantity-editing half was short-lived**
— `0018_per_branch_stock.sql` below (shipped the same day) replaced it
once stock became genuinely per-branch, since a single quantity field is
ambiguous once there's more than one branch it could mean. `create_product`
kept the same shape, just pointed at the new per-branch ledger instead.

**Per-Branch Stock:** `products.quantity_in_stock` was a single
company-wide number from the start (see `0003_products.sql`) even though
every sale and stock movement already recorded which branch it happened
at — `branch_id` was explicitly "for reporting only." `0018_per_branch_stock.sql`
makes it real:

- **`product_stock`** (`product_id`, `branch_id`) → `quantity` is the new
  source of truth. `products.quantity_in_stock` becomes a
  trigger-maintained cache (`sync_product_quantity()`, fired on every
  `product_stock` change) that always equals the sum across branches — so
  every existing read path that wants the company-wide total (dashboard
  cards, both pages' "All Branches" view) kept working with no code
  changes at all.
- **`record_stock_movement()`, `record_sale()`, `record_return()`,
  `create_product()`** all now read/write `product_stock` at a specific
  branch instead of the aggregate. This is a real behavior change, not
  just internal plumbing: **"insufficient stock" now means insufficient
  *at that branch***, even if another branch has plenty. A branch that
  used to be able to sell a product it never physically received (because
  the check was against the company-wide total) can no longer do that —
  which is the entire point of this migration, but worth knowing before
  staff hit it for the first time. The low-stock crossing check
  (`0016_low_stock_notifications.sql`) moved with it: it now compares a
  specific branch's quantity before/after, not the aggregate.
- **`update_product()`** goes back to metadata-only (sku, name, category,
  unit, prices, reorder level, active status) — no quantity, no branch.
  Picked deliberately over making it branch-aware: Edit Product managing
  one branch's stock via a dropdown-plus-number-field would either be
  ambiguous or need non-trivial client-side interactivity to stay
  unambiguous, and Stock Movement already does this job fully
  branch-aware and audited. `ProductForm` (`src/components/inventory/
  ProductForm.tsx`) only renders the starting-quantity + branch fields
  when adding a *new* product now; editing an existing one is metadata
  only, with a note pointing at Stock Movement for corrections.
- **Backfill**: `stock_movements` has recorded a branch on every movement
  since it launched, so existing stock is reconstructed by replaying it
  per (product, branch), floored at 0 (the old insufficient-stock check
  ran against the aggregate, not per branch, so a branch's replayed net
  can dip below what the ledger alone would suggest). Whatever's left of
  each product's current `quantity_in_stock` beyond what the replay
  accounts for — stock that existed before any movement was ever logged,
  i.e. the 5 seed products and anything added before `0017` — is
  untracked and gets assigned entirely to the Abuja branch. Move it to
  wherever it actually is via Stock Movement if that's wrong for a given
  product.
- **Inventory Master and Sales Catalogue** now respect the header's
  branch filter (see "Global branch filter" above) instead of always
  showing the aggregate — `getProducts(branchId)` (`src/lib/products.ts`)
  left-joins `product_stock` filtered to the selected branch when one is
  chosen. The low-stock badge and Sales Catalogue's stock-status pill
  follow whichever number is showing, so they reflect the selected
  branch, not the company total, once a branch is picked.
- **Record Sale** needed the same fix: the product picker used to show
  each product's aggregate "in stock" count regardless of which branch
  the sale was for, which could show enough stock for a sale that would
  then fail at submission because that specific branch didn't have it.
  `SaleForm` (`src/components/sales/SaleForm.tsx`) now takes a
  `stockByBranch` map per product (from the new
  `getProductStockByBranch()` in `src/lib/products.ts`) and made the
  Branch `<select>` a controlled field, so the "in stock" hint and the
  quantity input's `max` both update live as the branch changes.
- Per-branch **reorder levels** are deliberately out of scope for this
  round — `reorder_level` stays one value per product, compared against
  whichever branch's quantity is relevant to the check at hand. A
  product could reasonably need a different threshold per branch; revisit
  if that becomes a real need.

**Business Profile:** `0019_business_profile.sql` adds `business_name`,
`business_address`, `business_phone`, and `business_email` to
`app_settings`, editable from Settings (admin-only, see "Settings & Dark
Mode" above) via `BusinessProfileForm`
(`src/components/settings/BusinessProfileForm.tsx`) and
`updateBusinessProfile()` (`src/app/dashboard/settings/actions.ts`).
Replaces the `BUSINESS_NAME` constant (`src/lib/constants.ts`) as the
source of truth for the business name shown on the login page and the
browser tab title — that constant now only serves as `getAppSettings()`'s
fallback if the table is unreachable, same role `FALLBACK_BRANCHES` plays
for `getBranches()`.

- **The login page needed real data fetching**, which meant it could no
  longer stay a single Client Component (`"use client"` can't do
  server-side Supabase reads). Split into a thin Server Component
  (`src/app/login/page.tsx`, fetches `getAppSettings()`) and
  `LoginForm.tsx` (the interactive part, unchanged apart from taking the
  business fields as props instead of importing the constant). Address,
  phone, and email — if set — render as a compact line under the
  copyright footer; empty fields are simply omitted, not shown as blanks.
- **The browser tab title needed the same fix**: `src/app/layout.tsx`'s
  static `export const metadata` became an async `generateMetadata()`
  (Next.js's mechanism for metadata that depends on a data fetch).
- **This is the app's first anon-readable table content.** Every other
  table restricts `SELECT` to `authenticated` (see the `Role enforcement`
  and `Gotcha for future SECURITY DEFINER functions` sections above for
  why that boundary is taken seriously elsewhere). `app_settings` gets a
  deliberate, narrow exception: a business's name/address/phone/email is
  information it would already show on a public storefront or website —
  there's nothing to protect — and the login page, by definition, runs
  before anyone has signed in. `default_reorder_level` (not
  business-related) rides along on the same row since `app_settings` is a
  single-row table with no per-column RLS, but it isn't sensitive either
  (a UI pre-fill default, not business data). Don't reuse this precedent
  for a table that has anything actually sensitive on it.
- **Logo upload** is a separate feature — see "Logo Upload" below.

**Logo Upload:** `0020_logo_upload.sql` adds a **public** Storage bucket
(`branding`) — a deliberate contrast with the private `documents` bucket
(`0010_documents.sql`): a logo needs to render on the pre-login screen, so
it's served via Supabase's direct, unsigned public URL rather than a
short-lived signed one, same reasoning as `app_settings`'s anon-read
exception above. Upload/replace/delete are still admin-only, via the same
`is_admin()`-gated storage policies `documents` already established for
its delete policy.

- **`updateLogo()`/`removeLogo()`** (`src/app/dashboard/settings/actions.ts`)
  validate the file (PNG/JPEG/WebP/SVG only, 2MB max) before uploading to
  a **fixed path** (`logo/current`, `upsert: true`) — replacing a logo
  never leaves an orphaned old file under a different name/extension
  behind, and there's never more than one file in the bucket.
  `app_settings.logo_path` just stores that fixed path;
  `getAppSettings()` (`src/lib/settings.ts`) resolves it to a public URL
  via `getPublicUrl()` (a pure string construction, no network call, no
  RLS involved) and returns it as `logoUrl`.
- **`Logo`** (`src/components/layout/Logo.tsx`) takes an optional
  `logoUrl` prop; when set, it replaces the static `/logo.jpg` mark. Threaded
  down from `getAppSettings()` in three places that each already fetch
  settings for another reason: `src/app/dashboard/layout.tsx` (through
  `DashboardShell` → `Sidebar`/`MobileNav`) and `src/app/login/page.tsx`
  (through `LoginForm`) — no new fetches added.
  `next.config.ts`'s `images.remotePatterns` was extended to allow
  `next/image` to optimize a remote URL from the Supabase Storage domain
  (derived from `NEXT_PUBLIC_SUPABASE_URL` at build time, not hardcoded),
  which it otherwise refuses to do for security reasons.
- **The stylized two-line wordmark next to the mark** ("GAFBEZ" / "ENERGIES
  LTD", in `Logo.tsx`) stays static — splitting an arbitrary business name
  into that two-line treatment doesn't generalize (not every name has an
  obvious "first word / rest" split), so it was left alone rather than
  guessed at. The **plain-text company name in the Sidebar's footer**
  (`src/components/layout/Sidebar.tsx`) is a simpler case and *was* made
  dynamic, since it's just one line of text, not stylized typography.

**CSV Export:** Daily Sales, Expenses, and Customers each have an "Export
CSV" button next to their existing filter, via a shared `downloadCsv()`
helper (`src/lib/csv.ts`). Deliberately **client-side only, no new server
route**: `SaleTable`/`ExpenseTable`/`CustomerTable` are already Client
Components holding the filtered rows they're rendering (for the
status/category/search filter), so export just serializes that same
in-memory array to a CSV string and triggers a browser download (`Blob` +
an object URL + a synthetic `<a download>` click) — no extra request, and
the exported rows always match exactly what's on screen, filters
included. Column values that might contain a comma or quote (e.g. an
expense description) are CSV-quoted; everything else is written plain.
Customers' export includes Name, Phone, Email, Address, Branch, and
Outstanding Balance — available to both admins and staff, same as the
page itself (no cost/profit data involved). Sales Tracker still doesn't
have a row-level export — its data is aggregate/chart-shaped (KPI cards,
a branch-comparison chart, a daily trend chart, and now a per-staff
breakdown), not a row-per-record table like Daily Sales/Expenses, so
"export what's on screen" doesn't map onto it as directly; worth adding
on request if that specific shape (e.g. one row per day, per branch, or
per staff member) turns out to be useful.

**Staff Attribution:** Stock Movement, Daily Sales, and Expenses have
captured `created_by` since each launched, but nothing ever read it back
— every list was silent on who actually recorded a given row. Fixed
without touching `stock_movements`/`sales`/`expenses` at all: each now
also `select`s its existing `created_by` column, and
`getStockMovements()`/`getSales()`/`getExpenses()` (`src/lib/stockMovements.ts`,
`src/lib/sales.ts`, `src/lib/expenses.ts`) resolve it to a name via a new
`getStaffNameMap()` (`src/lib/staff.ts`), rendered as a "Recorded by"
column.

- **Why not a straightforward `profiles(full_name)` embed**, the way
  `customers(name)`/`branches(name)` already work elsewhere in these same
  queries: `profiles` RLS only lets someone read their own row, or every
  row if they're an admin (see "Staff Management" above) — a non-admin
  embedding `profiles` here would see their own name and a blank for
  every row anyone else recorded. Loosening `profiles`' `SELECT` policy
  outright would also expose email/role/branch to every signed-in user,
  undoing the boundary Staff Management deliberately drew.
- **`get_staff_names()`** (`0021_staff_attribution.sql`) is a narrow
  `SECURITY DEFINER` function returning only `id`/`full_name` for every
  profile — nothing sensitive, so it's granted to `authenticated`
  broadly rather than admin-gated, same reasoning as names already being
  visible team-wide in the Customers list. `getStaffNameMap()` calls it
  once per page load and resolves every row's `created_by` from the
  resulting map, rather than a per-row lookup.
- **Scope**: only these three lists. Documents (`uploaded_by`),
  Notifications, and Returns also capture a creator but don't show it yet
  — the same `getStaffNameMap()` would cover them too if that's wanted
  later; left out for now since nothing asked for it there specifically.

**Sales by Staff:** a "Sales by Staff" panel on Sales Tracker
(`src/components/sales/StaffSalesChart.tsx`), same bar-list treatment as
the existing "Sales by Branch" chart, showing each staff member's total
revenue and transaction count for the selected date range, ranked highest
first. `getSalesByStaff()` (`src/lib/salesTracker.ts`) reuses the
tracker's existing `fetchSales()` query (no new table read) and groups
its rows by `created_by`, resolving names via the same `getStaffNameMap()`
Staff Attribution introduced — no new migration needed for this feature.
A sale with no `created_by` (recorded before Staff Attribution shipped)
is grouped under "Unattributed" rather than dropped, so historical totals
still add up. Like the by-branch chart, this always aggregates across
every branch regardless of the header's branch filter, since comparing
staff is the point. Admin-only — see "Role-Based Visibility" below for
why.

**Top Products:** a "Top Products" panel on Sales Tracker
(`src/components/sales/TopProductsChart.tsx`), ranking products by
revenue for the selected date range (units sold shown alongside each
bar), capped at the top 8. `getTopProducts()` (`src/lib/salesTracker.ts`)
queries `sale_items` joined to `products` (name/SKU) and `sales`
(for the date filter, via `sales!inner(created_at)` — the same join
technique `fetchCogs()` already used in this file), then aggregates by
`product_id` in JS and sorts by revenue. Gross, not net of returns — same
"activity view" reasoning as Sales by Branch/Sales by Staff, not the
profitability summary (see the comment on `getSalesSummary()`). Unlike
Sales by Staff, this is **available to everyone**, not admin-gated —
it's revenue/unit counts, no cost or profit data, and knowing what's
actually selling is directly useful for staff too (restocking
conversations, upselling), not a coworker-comparison view. No new
migration needed — `sale_items`/`products`/`sales` were already readable
under existing RLS.

**Role-Based Visibility (Cost & Profit):** non-admin staff should be able
to sell and track inventory day-to-day without ever seeing cost price or
profit figures — margins are ownership/management information, not
something every staff member across every branch needs. Four places
carried cost-derived data before this; each is now gated on
`getCurrentUser().role === "admin"`, checked **server-side, before
rendering**, so the values never enter the page's data for a non-admin —
not "fetched but hidden by CSS," genuinely absent from what the browser
receives:

- **Dashboard**: Total Inventory Value, Expected Inventory Revenue,
  Estimated Gross Profit, and Net Profit — all four cost-derived cards —
  are filtered out of the `metrics` array (`src/app/dashboard/page.tsx`)
  before the `.map()` that renders `DashboardCard`s runs, for non-admins.
  Total Products, Total Units in Stock, Today's Sales, and Outstanding
  Customer Balance stay visible to everyone.
- **Sales Tracker**: the "Gross Profit" KPI card is wrapped in an
  `isAdmin` check; Total Sales, Transactions, Average Sale, and both
  charts (all revenue/count-based, no cost data) stay available to staff
  — trends and branch comparison are useful for day-to-day selling, just
  without the margin figure. The card grid drops from 4 to 3 columns when
  it's hidden. The "Sales by Staff" chart (see below) is admin-only too —
  it's not a cost/profit figure, but comparing coworkers' individual
  numbers is a management view, not something staff need to see about
  each other — so `getSalesByStaff()` isn't even queried for a
  non-admin (`isAdmin ? getSalesByStaff(window) : Promise.resolve(null)`
  in `src/app/dashboard/sales-tracker/page.tsx`).
- **Inventory Master**: became **fully admin-only** — the list, Add
  Product, and Edit Product pages all now open with a `user?.role !==
  "admin"` check *before* fetching any product data (same "Admins only"
  `EmptyState` pattern Staff Management already used), so `getProducts()`
  is never even called for a non-admin, let alone rendered. Hidden from
  the sidebar too (`adminOnly: true` in `src/lib/navigation.ts`, same flag
  Staff Management uses). Staff keep Sales Catalogue (browsing/stock
  status, no cost data) and Stock Movement (recording stock in/out) for
  the same day-to-day work Inventory Master used to also cover.
  `create_product()`/`update_product()` gained an `is_admin()` check
  inside the function itself (`0022_inventory_admin_only.sql`) — before
  this, the RPCs were still callable by any authenticated user even
  though the UI now blocks the page, a real gap for anyone who found the
  RPC name directly. Deleting was already admin-only from
  `0008_role_enforcement.sql`; create/update now match it.
- **Sales Catalogue**: was already UI-hiding `costPrice` (never rendered
  it), but was still shipping it to the browser in the page's data,
  inspectable via dev tools even though nothing displayed it. Fixed
  regardless of role — the page maps each product down to an explicit
  field list that excludes `costPrice` before passing to `CatalogueGrid`,
  so it's absent from the payload for every viewer, admin included, since
  nothing on this page ever needs it.

**Branch-Locked Staff:** a non-admin with an assigned branch
(`profiles.branch_id`, set from Staff Management — see above) can now
only record a sale or a stock movement at that branch, and their view
defaults there on login instead of "All Branches." Two independent
pieces:

- **The default** (see "Global branch filter" above) is just that — a
  default. A staff member can still switch the header's branch selector
  to check what another branch has in stock (Sales Catalogue, Inventory
  visibility elsewhere), exactly the "let me see if another store has
  this" case that prompted this feature. Nothing about browsing/viewing
  is restricted.
- **Recording a sale or stock movement is a hard lock, not a default.**
  `SaleForm`/`StockMovementForm` render the branch field as fixed text
  (plus a hidden input carrying the id) instead of a `<select>` for a
  restricted user, so there's no UI path to choose a different branch —
  and `record_sale()`/`record_stock_movement()` both check it
  server-side too (`0023_branch_locked_staff.sql`): `not
  is_admin() and branch_id is not null and branch_id <> p_branch_id` →
  reject. The UI lock alone wouldn't stop a direct RPC call with a
  different `p_branch_id`; the database check is the real boundary, same
  "UI hides it, the function enforces it" split used everywhere else
  privileged actions exist in this app.
- **"Staff can only sell what's available at their location" falls out
  for free** from combining this with per-branch stock
  (`0018_per_branch_stock.sql`): `record_sale()`'s insufficient-stock
  check already runs against `product_stock` at whatever branch is on the
  request. Once that branch can only ever be the staff member's own, they
  can never oversell beyond their own location's real stock — no separate
  check was needed for that specific requirement.
- **Admins are never restricted** — they keep the full branch dropdown on
  both forms and can record for any branch, needed for cross-branch
  oversight. **A staff member with no assigned branch is also left
  unrestricted**, same as before this migration — forcing a hard block on
  an unassigned account would leave them unable to work at all rather
  than degrade gracefully; assign them a branch from Staff Management to
  activate the lock.

**Supplier, Profit Margin & Reorder Level:** three additions to the
Inventory Master list/form (`0024_product_supplier.sql`), all admin-only
by inheritance — the page and its RPCs were already fully admin-gated
(see "Role-Based Visibility" above), so nothing extra was needed to keep
these out of a staff member's view.

- **Supplier** is genuinely new data — an optional free-text field
  (`products.supplier`) added to `ProductForm` and both `create_product()`/
  `update_product()`. A changed RPC signature is a different function to
  Postgres, so (same technique as `update_product()`'s rewrite in
  `0018_per_branch_stock.sql`) both functions were dropped and recreated
  with a `p_supplier text default null` param, then re-granted to
  `authenticated` only — re-verified with an anon-key script, same as
  every RPC change in this project.
- **Reorder Level** already existed as data — it's driven low-stock
  alerts since `0016_low_stock_notifications.sql` — but was never shown
  as a column in the product list itself, only surfaced indirectly via
  the "Low" badge on Stock. It's now its own column alongside Stock.
- **Profit Margin** needed no new column or function at all — it's
  computed client-side in `ProductTable.tsx` from the `costPrice`/
  `sellingPrice` already on every row (`sellingPrice - costPrice`, and
  that amount as a percentage of `sellingPrice`), shown as e.g. "₦15,000
  (25%)". Shows "—" if `sellingPrice` is 0 (division by zero) rather than
  a broken percentage.

**Inventory Master summary cards:** four KPI cards above the product list
— Total Products, Total Cost Value, Total Selling Value, and Estimated
Profit — computed server-side in `src/app/dashboard/inventory/page.tsx`
from the same `products` array the table below already renders (`sum(cost
× qty)`, `sum(selling × qty)`, and their difference). Two deliberate
differences from the similarly-named cards on the Dashboard
(`getLiveInventoryDashboardData()`, `src/lib/dashboard.ts`):

- **Respects the header's branch filter**, rather than always being
  company-wide — since the table underneath already shows one branch's
  real quantity or the all-branch total depending on that filter, the
  cards stay in sync with exactly what's listed below them instead of
  quietly showing a different scope.
- **Includes inactive products**, where the Dashboard's figures are
  active-only. Inventory Master's table already lists inactive products
  too (with a "Inactive" badge), and stock sitting in an inactive product
  still has real cost tied up in it, so excluding it here would make the
  card total not match a sum of the rows visibly below it.

Both cards are admin-only by the same page-level gate as the rest of
Inventory Master — no separate check needed.

**Date & time on transaction records:** table cells that show a real
timestamp (`created_at` on stock movements, sales, and documents; the
dashboard's Recent Sales/Recent Stock Movements) now render the date and
time stacked — date on top, time smaller and muted underneath — via the
shared `<DateTimeCell>` component (`src/components/ui/DateTimeCell.tsx`)
and `formatDate()`/`formatTime()` helpers (`src/lib/format.ts`). Two
places deliberately stayed date-only: the Sales Tracker's From/To range
picker (a calendar-date filter, not a transaction moment) and Expenses'
`expense_date` (a `date` column with no time component at all — it's the
day an expense is *dated to*, not a captured timestamp; `created_at` on
the row does have a time, but isn't what the list displays). Notifications
already combined date and time inline before this change, so it was left
as-is.

**Gotcha for future `SECURITY DEFINER` functions:** Supabase grants
`EXECUTE` on newly created functions directly to the `anon` role, not just
to `PUBLIC`. `revoke all ... from public` alone does **not** block
unauthenticated callers — you must also `revoke all ... from anon`
explicitly (see `0004_stock_movements.sql` and `0006_sales.sql` for the
pattern). This was caught and fixed during development; verify with an
anon-key RPC call before trusting any new privileged function.

**Gotcha for controlled numeric inputs:** if a form needs live client-side
math (running totals, etc.) and so needs a numeric `<input>` bound to React
state via `value={...}`, don't coerce the typed string to a number with a
fallback in `onChange` (e.g. `Number(e.target.value) || 1`) — clearing the
field to type a new value makes `Number("")` evaluate to `0`, and `0 ||
1` snaps straight back to `1` on every keystroke, so the field can never be
edited. Keep the input bound to a **string** in state and only convert to a
number at the point of use (math, submission) — see
`src/components/sales/SaleForm.tsx`. Forms that don't need live
client-side math (`ProductForm`, `CustomerForm`, `StockMovementForm`) avoid
this entirely by using plain uncontrolled inputs (`defaultValue`).

**Gotcha for dates in Server Components:** ESLint's `react-hooks/purity`
rule flags calling `Date.now()` (or `new Date()`) directly in a component's
render body, even in an `async` Server Component — it errors with "Cannot
call impure function during render." Compute dates in a plain helper
function in your data layer (`src/lib/*.ts`, not a `.tsx` component file)
instead — see `daysToSinceDate()` in `src/lib/salesTracker.ts`.

## Development Command

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The root URL
redirects to `/login`.

## Production Build Command

```bash
npm run build
npm run start
```

## Current Completed Features

- Next.js App Router project with TypeScript, Tailwind CSS, and ESLint
  configured.
- Renewable-energy brand theme (dark green primary, white card surfaces,
  warm off-white page background, gold used as a small accent in
  navigation/badges/chrome) defined as reusable Tailwind theme tokens in
  `src/app/globals.css`.
- Real staff authentication: `/login` signs in against Supabase Auth via a
  Server Action, shows real validation errors, and redirects to
  `/dashboard` on success. `/dashboard/*` is protected by `src/proxy.ts`,
  which also refreshes the session on every request. Logging out clears the
  Supabase session and redirects to `/login`. No public sign-up and no
  hard-coded credentials — staff accounts are provisioned via the Supabase
  dashboard.
- `/dashboard` responsive layout with a collapsible sidebar, mobile
  navigation drawer, top header showing the signed-in user's real name/email
  and role, a notification bell with a **live unread count** from the
  `notifications` table, a **functional global branch filter** (persisted
  via cookie, scopes Customers, Stock Movement, Daily Sales, Expenses, and
  Documents — see "Global branch filter" above), and a working logout
  button.
- Sidebar navigation covering Dashboard, Inventory Master, Stock Movement,
  Sales Catalogue, Daily Sales, Sales Tracker, Customers, Expenses,
  Documents, Notifications, Staff Management, Installation, and Settings —
  every one a real module, no remaining placeholders.
  Staff Management **and Inventory Master** are hidden from the sidebar
  entirely for non-admin users (`src/lib/navigation.ts`'s `adminOnly`
  flag, filtered in `NavList`) — see "Role-Based Visibility (Cost &
  Profit)" above for why Inventory Master joined Staff Management here.
- **Light/dark theme** across the entire app (every page, table, form,
  badge, and the login screen), switchable from Settings, with no flash
  on load — see "Settings & Dark Mode" above.
- Dashboard metric cards (Total Products, Total Units in Stock, Total
  Inventory Value, Expected Inventory Revenue, Estimated Gross Profit, Net
  Profit, Today's Sales, Outstanding Customer Balance), each with a distinct
  accent color and icon from a validated, colorblind-safe palette
  (`src/lib/palette.ts`) — see "Dashboard Color Palette" below. **Every
  card and every section is now live** — "Low Stock Products", "Recent
  Stock Movements", "Recent Sales", "Sales by Branch", and "Recent
  Notifications" all compute from real tables (`src/lib/dashboard.ts`,
  `src/lib/stockMovements.ts`, `src/lib/sales.ts`,
  `src/lib/salesTracker.ts`, `src/lib/expenses.ts`,
  `src/lib/notifications.ts`). "Net Profit" is live but simplified — see
  the Expenses bullet below. **Non-admins see 4 of the 8 cards** (Total
  Inventory Value, Expected Inventory Revenue, Estimated Gross Profit, and
  Net Profit are admin-only) — see "Role-Based Visibility (Cost & Profit)"
  above.
- **Inventory Master** (`/dashboard/inventory`): **admin-only** (see
  "Role-Based Visibility (Cost & Profit)" above) — full CRUD for the
  product catalog, backed by the live `products` table plus real
  per-branch stock in `product_stock` — see "Per-Branch Stock" above.
  - Four summary cards above the list — Total Products, Total Cost Value,
    Total Selling Value, Estimated Profit — see "Inventory Master summary
    cards" above.
  - List view with live search (by name/SKU) and category filter, both
    client-side and instant. Respects the header's branch filter: shows
    that branch's real quantity, or the company-wide total under "All
    Branches".
  - Add (`/dashboard/inventory/new`): metadata plus a starting quantity
    and the branch it's received at — submitted via `create_product()`,
    which logs the starting quantity as a `stock_movements` row too (see
    "Product Stock Audit Trail" above).
  - Edit (`/dashboard/inventory/[id]/edit`): metadata only (no quantity or
    branch) — via `update_product()`. Stock corrections after creation go
    through Stock Movement instead, which is branch-aware and audited.
  - Delete with a confirmation prompt.
  - Low-stock badge when the shown quantity (branch-specific or
    aggregate, per the filter above) is `<= reorder_level`. Crossing that
    threshold from Add Product, Stock Movement, or a sale posts an
    automatic low-stock notification too — see "Low-Stock Notifications"
    above.
  - List columns also include **Supplier** (optional free-text field),
    **Profit Margin** (computed, ₦ amount + %), and **Reorder Level** —
    see "Supplier, Profit Margin & Reorder Level" above.
  - Prices formatted as Naira via `src/lib/format.ts`.
- **Stock Movement** (`/dashboard/stock-movement`): an append-only ledger
  of stock received/issued per branch, backed by the live
  `stock_movements` table.
  - List view with Type (In/Out) and Branch filters.
  - Record Movement page (`/dashboard/stock-movement/new`) submitted via a
    Server Action that calls the `record_stock_movement()` Postgres
    function — this atomically adjusts the product's stock **at the
    chosen branch** and inserts the ledger row in one transaction, so a
    rejected "Stock Out" (insufficient stock at that branch) never leaves
    a partial write. See "Per-Branch Stock" above. A non-admin with an
    assigned branch can't choose a different one here — see
    "Branch-Locked Staff" above.
  - Movements are immutable — no edit or delete, by design (audit trail
    integrity; corrections are recorded as new movements).
  - List respects the header's global branch filter.
  - "Recorded by" shows who logged the movement — see "Staff Attribution"
    above.
- **Customers** (`/dashboard/customers`): full CRUD for customer records,
  backed by the live `customers` table.
  - List view with live search (name/phone/email), respecting the header's
    global branch filter.
  - Add/Edit pages sharing one form component, via Server Actions.
  - Delete with a confirmation prompt.
  - `outstanding_balance` is a manually-editable number for now, though
    Daily Sales now also updates it automatically when a sale isn't paid
    in full — see below.
  - "Export CSV" downloads whatever's currently filtered/visible in the
    list (Name, Phone, Email, Address, Branch, Outstanding Balance) — see
    "CSV Export" above.
  - **Customer Detail** (`/dashboard/customers/[id]`, new — via the "view"
    eye icon on each row): four summary cards (Total Spent, Purchases,
    Average Purchase, Outstanding Balance), a contact-details block
    (phone/email/address/notes), and the customer's full purchase history
    reusing `SaleTable` (same status filter, CSV export, and per-sale
    "view" link it already has on Daily Sales). `getSales()`
    (`src/lib/sales.ts`) gained an optional `customerId` param — a third
    positional argument after `limit`/`branchId` — so this page can filter
    to one customer's sales without a separate query function. No cost or
    profit data on this page (revenue only), so it's open to every
    signed-in user, same as the rest of Customers.
- **Daily Sales** (`/dashboard/daily-sales`): multi-line-item sales,
  backed by the live `sales`/`sale_items` tables.
  - List view with a Paid/Partial/Unpaid status filter, respecting the
    header's global branch filter.
  - Record Sale page: pick an optional customer (or "Walk-in customer"), a
    branch (fixed to their own for a non-admin with an assigned branch —
    see "Branch-Locked Staff" above), add any number of product line
    items (quantity + unit price, pre-filled from the product's selling
    price but editable), and an amount paid. The product picker's "in
    stock" hint and each quantity input's max both track the chosen
    branch's *real* stock live (see "Per-Branch Stock" above) — pick a
    different branch and the numbers update. Submitted via a Server
    Action that calls the `record_sale()` Postgres function, which in one
    transaction:
    1. Validates and deducts stock **at the chosen branch** for every line
       item (same insufficient-stock guard as Stock Movement — the whole
       sale is rejected if any item can't be fulfilled there, never a
       partial sale).
    2. Inserts the sale header and line items, capturing each item's
       `unit_cost` from the product's current `cost_price` — see "Profit
       Tracking" below.
    3. Logs a matching `stock_movements` "out" row per line item, so Stock
       Movement stays a complete audit trail even for sale-driven
       deductions.
    4. If the amount paid is less than the total and a customer is linked,
       adds the shortfall to that customer's `outstanding_balance`.
  - Sales are immutable — no edit or delete — but a sale's detail page
    (`/dashboard/daily-sales/[id]`, linked via a "view" icon on each list
    row) supports **partial, line-item returns**, which record a separate
    `sale_returns` row rather than mutating the original sale. See
    "Returns" above.
  - "Export CSV" downloads whatever's currently filtered/visible in the
    list — see "CSV Export" above.
  - "Recorded by" shows who logged the sale — see "Staff Attribution"
    above.
- **Sales Tracker** (`/dashboard/sales-tracker`): analytics over the
  `sales`/`sale_items`/`sale_returns` tables, no new tables of its own.
  - KPI cards (Total Sales, Gross Profit, Transactions, Average Sale) and
    four charts (Sales by Branch, Top Products, Sales by Staff, Daily
    Sales Trend), with Total Sales/Gross Profit **net of returns** — see
    "Returns" above. **Gross Profit and Sales by Staff are admin-only**
    — see "Role-Based Visibility (Cost & Profit)" above; staff keep the
    rest of the page, Top Products included. See "Sales by Staff" and
    "Top Products" above for how each breakdown is computed.
  - Date range picker: three presets (7/30/90 days, all time) via a
    `?range=` query param, plus a From/To picker (`SalesDateFilter`, a
    plain server-rendered `<form method="GET">` with no client JS) via
    `?from=&to=` for any custom range, including a single day (pick the
    same date in both fields). Both paths go through `rangeToWindow()`/
    `daysToWindow()` (`src/lib/salesTracker.ts`), which produce a common
    `DateWindow { since, until }` that every query in the file filters on
    — `getSalesTrend()` requires both ends bounded (it buckets one point
    per day in the range) and returns `null` otherwise, which is why the
    preset path always pairs `range` with a matching bounded window for
    the trend chart even when the summary/by-branch queries use an
    unbounded "since" for "all time."
  - Chart bars follow the `dataviz` skill's mark spec (thin, rounded
    data-ends, single brand-green hue since each chart is one series, no
    legend needed for a single series).
  - "Sales by Branch" here always covers every branch — the header's
    global branch filter doesn't apply to it (see "Global branch filter"
    above).
  - **Layout, top to bottom**: the range/date filters are grouped in
    their own bordered card (previously two loose rows sitting directly
    on the page background), then the KPI cards, then charts. "Sales by
    Branch," "Top Products," and "Sales by Staff" are grouped in one
    row — all three are the same visual shape (a ranked bar list) — at
    3 columns for admins or 2 for staff (Sales by Staff drops out, the
    row just closes the gap rather than leaving an empty column).
    "Daily Sales Trend" was pulled out into its own full-width row below,
    rather than competing for a third/quarter width in that same grid —
    a day-by-day line reads better with the extra horizontal room. See
    "Colorful cards beyond the Dashboard" above for the KPI cards' accent
    colors.
- **Expenses** (`/dashboard/expenses`): full CRUD for operational expenses,
  backed by the live `expenses` table.
  - "Expenses by Category" — a ranked bar-list breakdown (amount + % of
    total) above the list, same visual language as Sales Tracker's
    charts. Computed in `src/app/dashboard/expenses/page.tsx` by grouping
    the already-fetched `expenses` array by `category`, so it needs no
    new query and automatically respects the header's branch filter, same
    as the list below it. Available to everyone — expense amounts aren't
    gated the way product cost/profit is (see "Role-Based Visibility"
    above); staff already fully read/create/edit expenses.
  - List view with a category filter and a running total for the current
    filter, respecting the header's global branch filter.
  - "Export CSV" downloads whatever's currently filtered/visible in the
    list — see "CSV Export" above.
  - "Recorded by" shows who logged the expense — see "Staff Attribution"
    above.
  - Add/Edit pages sharing one form component, via Server Actions. Plain
    CRUD (not append-only) — see the migration note above for why.
  - Feeds the dashboard's "Net Profit" card: **all-time (sales revenue minus
    cost of goods sold) minus all-time expenses** — true net profit, not a
    revenue proxy. See "Profit Tracking" below.
- **Role enforcement (first pass)**: deleting products, customers, or
  expenses requires `profiles.role = 'admin'`, enforced at the database
  level (RLS) and mirrored in the UI — see "Role enforcement" above.
  Everything else (create, edit, recording sales/stock movements) stays
  open to any signed-in staff member.
- **Sales Catalogue** (`/dashboard/sales-catalogue`): a read-only,
  card-grid browsing view of active products, no new table of its own
  (reuses `products`/`product_stock`).
  - Search (name/SKU) and category filter, both client-side.
  - Each card shows a stock-status badge (In stock / Low stock / Out of
    stock) and the selling price, prominently — deliberately **not**
    `costPrice`, since this view is for quick reference/quoting, not
    margin data. `costPrice` is stripped from the page's data before it
    reaches the browser at all (for every viewer, not just staff) — see
    "Role-Based Visibility (Cost & Profit)" above.
  - Distinct from Inventory Master by design: this is a lightweight
    browsing view for day-to-day reference, not the administrative CRUD
    table.
  - Respects the header's branch filter — the stock-status badge reflects
    that branch's real quantity, or the company-wide total under "All
    Branches". See "Per-Branch Stock" above.
- **Notifications** (`/dashboard/notifications`): a shared, company-wide
  notice board, backed by the live `notifications` table.
  - Inline "Post a notification" form (message + type: Info/Warning/
    Success) right on the list page — no separate `/new` route, since it's
    only two fields.
  - "Mark read" per notification; unread ones are visually highlighted.
  - **Manual posts plus one automatic alert**: staff-posted notifications
    (via the inline form above) are still the only user-initiated kind, but
    `record_sale()`, `record_stock_movement()`, `create_product()`, and
    `update_product()` now also post a `'warning'` notification
    automatically the moment a product's stock crosses at-or-below its
    reorder level — see "Low-Stock Notifications" above. Other automatic
    alerts (sale confirmations, etc.) remain unimplemented.
  - **Shared read state, not per-user**: `is_read` is one flag per
    notification, so marking one read marks it read for the whole team.
    Simpler than a per-user "seen" join table, appropriate for a small
    internal team; revisit if that stops being true.
  - Feeds the header's notification bell badge (live unread count) and the
    dashboard's "Recent Notifications" section.
- **Documents** (`/dashboard/documents`): file upload/download/delete,
  backed by a private Supabase Storage bucket plus a `documents` metadata
  table — see "Documents & Storage" above.
  - Upload form (file, optional branch, optional category) inline on the
    list page.
  - Download via short-lived (60s) signed URLs generated on click, never a
    stored/public link.
  - Delete removes both the Storage object and the metadata row, and is
    admin-only.
  - List respects the header's global branch filter.
- **Staff Management** (`/dashboard/staff-management`, admin-only): manage
  existing staff profiles — see "Staff Management" above for the full
  design and its deliberate scope boundary (no `service_role` key, so
  account creation itself stays in the Supabase Dashboard).
  - List of every staff profile: name, email, branch, role, active status.
  - Edit page: name, branch, role, and an active/inactive toggle.
  - Deactivating blocks sign-in; an admin can't demote or deactivate their
    own account.
- **Installation** (`/dashboard/installations`): tracks profit per solar
  installation job — what the customer was charged vs. what the inverter,
  panels, battery, cable, accessories, and labor actually cost, backed by
  the live `installations` table (`0025_installations.sql`).
  - Four summary cards — Total Amount Charged, Total Amount Used, Total
    Profit, and Profit Margin (%) — scoped to the header's branch filter,
    same convention as Inventory Master/Sales Tracker/Customer Detail.
  - Add/Edit form: total amount charged, then three product-picker rows
    (Inverter, Solar panels, Battery) — each pulls its price from the
    catalogue when a product is selected but stays editable, plus a units
    field for when a job uses more than one. Cable, Accessories, and
    Installation/labor are plain amount fields (not tied to inventory).
    Cost and profit are shown live as you fill the form.
  - **Deliberately doesn't touch stock**: picking a product here only
    snapshots its price for the record — it does not deduct
    `product_stock` or write a `stock_movements` row. If the parts really
    left the shelf, log that separately via Stock Movement. (Also doesn't
    link to a `customers` row — it's a standalone job record.)
  - `cost_total` and `profit` are Postgres generated columns (derived from
    the price/qty/amount fields), not computed in the app, so the numbers
    can't drift from what's actually stored.
  - Plain CRUD like Expenses (not append-only) — a data-entry mistake can
    be corrected in place. Delete is admin-only; create/edit stays open to
    any signed-in staff member.
  - Visible to all staff in the sidebar (not admin-only), positioned right
    after Staff Management.
- **Settings** (`/dashboard/settings`): personal preferences plus
  system-wide defaults — see "Settings & Dark Mode", "Business Profile",
  "Logo Upload", and "Branch Management" above.
  - Appearance: Light/Dark/System theme toggle, available to everyone,
    saved per device.
  - Business Profile: company name, address, phone, email, and a logo
    upload, admin-only — feeds the login page, browser tab title, sidebar,
    and mobile navigation drawer.
  - Inventory Defaults: default reorder level, admin-only, feeds the Add
    Product form.
  - Branches: add a branch, or rename/activate an existing one, admin-only.
    No delete — see "Branch Management" above.
- **My Account** (`/dashboard/account`): every signed-in user's own
  profile and password, reachable from the header avatar — see "My
  Account" above.
  - Edit your own name; email/role/branch are read-only here.
  - Change your own password (current password required), no admin or
    email setup needed.
- Branch list — All Branches (UI-only, not a database row), plus every row
  in the `branches` table (GAFBEZ Energies Abuja and Minna Branches active,
  Ilorin shown as coming soon/disabled out of the box, now manageable —
  and extensible — from Settings) — fetched live via a Server Component,
  with a static fallback if the database is unreachable.
- Supabase project connected: browser and server client utilities
  (`src/lib/supabase/`), environment variable scaffolding (`.env.example`),
  thirteen live tables — `branches`, `profiles`, `products`,
  `product_stock`, `stock_movements`, `customers`, `sales`, `sale_items`,
  `sale_returns`, `expenses`, `notifications`, `documents`, and
  `app_settings` — all with row-level security enabled, plus one private
  Storage bucket (`documents`).
- Reusable, typed components: `Sidebar`, `Header`, `MobileNav`,
  `DashboardShell`, `DashboardCard`, `DashboardSection`, `PageHeader`,
  `EmptyState`, `NotificationBadge`, and `BranchSelector`.
- Accessible, keyboard-operable navigation: focus styles, `aria-current` on
  the active link, a labelled mobile navigation dialog that closes on
  <kbd>Escape</kbd> and returns focus appropriately, and labelled form
  controls throughout.
- Fully responsive layout for mobile, tablet, and desktop.

**Mobile card layout for data tables:** every list backed by a `<table>`
(Inventory Master, Staff Management, Customers, Daily Sales, Expenses,
Stock Movement, Documents — 7 components) now renders two ways: a `<ul>`
of stacked cards below the `sm` breakpoint (`sm:hidden`), and the
original `<table>` from `sm:` up (`hidden sm:block`), both driven by the
same filtered data array so there's no duplicated logic beyond the
markup itself. Before this, every one of these tables relied on
horizontal scroll (`overflow-x-auto` plus a `min-w-[...]` on the
`<table>`) to stay usable on a narrow screen — technically scrollable,
but on a real phone it just looked cut off at the viewport edge with no
visible affordance to swipe, hiding price/stock/actions columns
entirely. Each mobile card shows the same fields as its table row, just
stacked (primary identifier + actions up top, a divider, then secondary
fields below) instead of laid out in columns. `DashboardCard`-based
summary rows (KPI cards) didn't need this — they already used a
`grid-cols-2` layout that fits a phone width on its own.

## Dashboard Color Palette

The 8 metric-card accent colors (`src/lib/palette.ts`) aren't hand-picked —
they're run through a categorical color validator that checks lightness
band, chroma floor, colorblind-safe (CVD) separation between adjacent
cards, and contrast against both the page and the white text on top of each
card. All 8 clear 4.5:1 contrast for white text, and the ordering was chosen
so the two closest hues in the set aren't adjacent in the card grid. If you
reorder the cards or swap a color, re-run the validator (from the `dataviz`
skill, if available) before shipping the change — don't eyeball it.

**Colorful cards beyond the Dashboard:** Sales Tracker's and Inventory
Master's summary cards were originally plain white/bordered boxes; both
now reuse the shared `DashboardCard` component and draw from the same
`DASHBOARD_PALETTE`, so every card-based summary in the app looks and
behaves consistently. Reusing the palette for a *different* subset/order
than the canonical 8-color sequence isn't automatically safe — the
validator only checked adjacency in that one specific order, so a new
arrangement can put two colors next to each other that were never tested
together. Both new sets were re-validated before shipping:

- **Sales Tracker** (Total Sales, Gross Profit, Transactions, Average
  Sale) uses violet, magentaDark, orange, and blue — chosen as a
  **mutually CVD-safe set** (every pair of the four passes, not just
  neighbors in one fixed order), because Gross Profit is admin-only and
  toggles in/out (see "Role-Based Visibility" above); when it's hidden,
  the remaining three shift into different adjacency than the four-card
  layout, so pairwise safety was required, not just sequential safety.
- **Inventory Master** (Total Products, Total Cost Value, Total Selling
  Value, Estimated Profit) uses tealDark, blue, red, and magentaDark, in
  that left-to-right order — the same accent/icon pairing as the
  Dashboard's conceptually equivalent cards (Total Products, Total
  Inventory Value, Expected Inventory Revenue, Estimated Gross Profit),
  so "cost value = blue" and "profit = magenta" read the same way on
  both pages. This set only needed sequential (not full pairwise) safety
  since none of its four cards ever hide — unlike tealDark and
  magentaDark, which fail CVD separation as a *pair* but are never
  adjacent in this fixed order.
- **Customer Detail** (Total Spent, Purchases, Average Purchase,
  Outstanding Balance) uses violet, orange, blue, and red, in that order
  — sequentially validated (none of its four cards ever hide either, so
  only adjacency mattered, not the full pairwise set Sales Tracker
  needed). orange and red fail CVD separation as a pair, same as
  tealDark/magentaDark above, but land two apart here (positions 2 and
  4), not adjacent.
- **Installation** (Total Amount Charged, Total Amount Used, Total Profit,
  Profit Margin) uses red, magentaDark, amberDark, and violet, in that
  order — a contiguous slice of the canonical 8-color sequence, so its
  three adjacent pairs (red↔magentaDark, magentaDark↔amberDark,
  amberDark↔violet) are already covered by the master validation above,
  with no need to re-run it. Sequential safety only, same reasoning as
  Inventory Master and Customer Detail (all four cards are always shown).

**Smaller, mobile/tablet-friendly cards:** `DashboardCard` itself shrank
its padding, icon badge, and type sizes at the `sm` breakpoint and below
(`p-3`/icon `h-7 w-7`/value `text-lg` on mobile, growing to the original
`p-5`/`h-9 w-9`/`text-2xl` from `sm:` up), with `truncate` on all three
text lines so a long label or a wide Naira figure can't force a card to
grow. Every card grid using it (Dashboard home, Sales Tracker, Inventory
Master) also switched from starting at a single stacked column
(`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) to always showing at least
2 columns (`grid-cols-2 lg:grid-cols-4`), so cards sit side-by-side even
on a small phone instead of stacking full-width and tall.

## Features Intentionally Not Implemented Yet

- Only **deleting** is role-gated (products, customers, expenses — admins
  only, see "Role enforcement" above), plus staff management itself
  (role/branch/active-status changes — admins only, see "Staff Management"
  above). Every signed-in user, regardless of role, can still create/edit
  `products`, `customers`, and `expenses`, and can record stock movements
  and sales — that's intentional for now, not a gap, but worth knowing if
  you expected broader gating.
- No **self-service account creation** — Staff Management manages
  role/branch/active-status for existing logins only. Creating a login
  itself still requires the Supabase Dashboard (Authentication → Users),
  since in-app creation would need the `service_role` secret key, which
  this app deliberately never handles — a leaked key bypasses RLS
  entirely. Same reasoning applies to full account deletion (not offered;
  deactivation is the in-app equivalent).
- No password reset flow for a **locked-out** user — "Forgot password?"
  on `/login` still shows an inline note rather than sending a real reset
  email (needs SMTP/email template setup first). My Account's Change
  Password only works for someone already signed in who knows their
  current password — it doesn't help someone who's forgotten it; an admin
  still has to reset it from the Supabase Dashboard for that case.
- No hard-coded staff credentials of any kind — accounts are provisioned
  via the Supabase dashboard.
- No per-branch reorder levels — `reorder_level` is still one value per
  product (stock itself is real per-branch as of `0018_per_branch_stock.sql`;
  see "Per-Branch Stock" above), compared against whichever branch's
  quantity is relevant to the check at hand.
- No automatic notifications beyond low-stock alerts (e.g. sale
  confirmations) — see the Notifications bullet above. Read state is
  shared across the whole team rather than per-user for every
  notification, automatic or manual.
- No reporting beyond Sales Tracker and CSV export (see "CSV Export"
  below) — no PDF export, scheduled/emailed reports, or a dedicated
  reporting module.
- No offline mode or data synchronization.
- Theme preference doesn't sync across devices — it's a per-browser
  cookie, not a `profiles` column. See "Settings & Dark Mode" above for
  why.
- The stylized two-line wordmark next to the logo mark ("GAFBEZ" /
  "ENERGIES LTD") stays static text — see "Logo Upload" above for why an
  arbitrary business name isn't auto-split into that layout.

These will be addressed in later development stages.
