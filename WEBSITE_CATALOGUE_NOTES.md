# Website Catalogue — Stage 2 Notes

Lets the Owner/Admin manage which Inventory Master products appear on the
public GAFBEZ Energies website, with their own website-facing copy, price,
images, and specs, while cost price, selling price, reorder level, supplier,
and every other operational field stays exactly as private as it already
was. This is a **BMS-only** change: the public website project (a separate
Next.js app) is not touched in this stage, and nothing here calls it.

## Naming/role mapping (read this first)

The task brief that drove this stage talks about "Owner/Admin" vs.
"Manager"/"Salesperson". This codebase's `profiles.role` only has two
values: `'admin'` and `'staff'` (see `0002_profiles.sql`,
`0008_role_enforcement.sql`) — there is no separate Manager or Salesperson
role anywhere in the schema, and Stage 2 does not introduce one. Everywhere
below:

- **"Owner/Admin"** means `role = 'admin'` (`public.is_admin()`).
- **"Manager/Salesperson"** means any non-admin authenticated staff account
  — i.e. everyone else. Same boundary as Inventory Master itself, Staff
  Management, Business Profile, and Branches.

Similarly, `branches.id` is `text` (`'abuja'`, `'minna'`, `'ilorin'`), not a
`uuid` — the task brief's suggested `get_website_catalogue_by_branch(p_branch_id uuid)`
signature was adjusted to `p_branch_id text` to match the real column type
instead of assuming one.

## Migration created

`supabase/migrations/0028_website_catalogue.sql` — the next available
number after `0027_installations_admin_only.sql`. **Not yet applied** to
the live database — see "Applying the migration" below.

## Fields added to `products`

| Column | Type | Default | Notes |
|---|---|---|---|
| `brand` | text | — | Free text, BMS suggests values, doesn't restrict them |
| `model` | text | — | |
| `short_description` | text | — | |
| `full_description` | text | — | |
| `website_price` | numeric(14,2) | — | `null` or `>= 0`. Independent of `cost_price`, `selling_price`, and any future branch price |
| `website_slug` | text | — | Unique when provided (plain `unique` constraint — Postgres already allows unlimited `null`s under it) |
| `product_image_url` | text | — | Public Storage URL, never base64 |
| `gallery_image_urls` | jsonb | `[]` | Must be a JSON array (`jsonb_typeof = 'array'` check) |
| `specifications` | jsonb | `{}` | Must be a JSON object (`jsonb_typeof = 'object'` check) |
| `warranty_text` | text | — | |
| `is_visible_on_website` | boolean | `false` | Safe-by-default: a brand-new product is invisible until an admin opts it in |
| `is_featured_on_website` | boolean | `false` | |
| `website_display_order` | integer | `0` | `>= 0` |
| `is_combo_eligible` | boolean | `false` | Flag only — no combo-package feature reads it yet |
| `calculator_eligible` | boolean | `false` | Flag only — no advanced-calculator feature reads it yet |

All columns added with `add column if not exists`, matching the existing
`0024_product_supplier.sql` convention, so re-running this migration is
harmless.

## Database objects created

- **`public.website_catalogue`** (view) — the safe, company-wide public
  product feed. A plain view (not `security definer`), but views execute
  against their underlying tables as the *view owner* (the role that ran
  the migration, which owns `public.products` and therefore isn't subject
  to its RLS policies), not as the querying role — the standard Supabase
  technique for exposing a safe slice of an RLS-protected table to `anon`.
  Only ever selects the columns listed in "Public fields exposed" below;
  `cost_price`, `selling_price`, `reorder_level`, `supplier`,
  `quantity_in_stock`, `created_at`, `updated_at` are never referenced by
  it, so there is no way to read them through this view regardless of
  caller role. Filters to `is_active = true and is_visible_on_website = true`.
  Granted `select` to `anon, authenticated`.

- **`public.get_website_catalogue_by_branch(p_branch_id text)`** (function,
  `security definer`) — same public fields plus one branch's own stock
  quantity/status instead of the company-wide total. Validates the branch
  exists and is `status = 'active'` (rejects unknown ids and Ilorin's
  `coming_soon` status the same way), then left-joins `product_stock`
  scoped to that branch so a product with no stock row at that branch
  returns `0`/`out_of_stock` rather than being omitted. Granted `execute`
  to `anon, authenticated`.

- **`public.update_product_website_details(...)`** (function,
  `security definer`) — the only write path for every website field.
  Checks `public.is_admin()` first and raises if not, exactly like
  `create_product()`/`update_product()` (`0022_inventory_admin_only.sql`).
  Full-replace semantics like `update_product()` (the caller always sends
  every field, not a partial patch), validates price/display-order/JSON
  shape with friendly error messages before writing, and returns only the
  public/website-facing columns (not the full `products` row, so callers
  never accidentally see cost data through this function's return value
  either — though as an authenticated admin RPC they could see it via
  Inventory Master's normal read path anyway). Granted `execute` to
  `authenticated` only (never `anon`).

- **Storage bucket `product-images`** — `public = true` (product photos are
  meant to be publicly visible, same reasoning as the existing `branding`
  bucket), `file_size_limit = 5 MB`, `allowed_mime_types = image/jpeg,
  image/png, image/webp`. Storage RLS: authenticated read, admin-only
  insert/update/delete — identical shape to `0020_logo_upload.sql`'s
  `branding` bucket policies, just renamed and with the size/type
  allowlist added as defence in depth.

## Storage configuration

Bucket creation is inside the migration itself (`insert into
storage.buckets ...`), same as `branding` — Supabase allows this via SQL,
so no separate dashboard step is required. After applying the migration,
verify in **Storage → product-images** that: bucket is public, file size
limit shows 5 MB, and the four policies (`Authenticated users can read
product images`, `Only admins can upload/update/delete product images`)
are present.

## BMS screens changed

- **`/dashboard/inventory/[id]/edit`** — now renders `ProductEditTabs`
  instead of a bare `ProductForm`: two tabs, **Inventory Details** (the
  original form, byte-for-byte unchanged, still posts to the original
  `updateProduct` action) and **Website Details** (new). Only on Edit —
  Add Product (`/dashboard/inventory/new`) is untouched, since website
  details/images can't attach to a product that doesn't have an id yet;
  the new tab's intro text is discoverable right after creating a product
  via Edit.
- **New components** (`src/components/inventory/`):
  `ProductEditTabs.tsx`, `ProductWebsiteDetailsForm.tsx`,
  `SpecificationEditor.tsx`, `ProductImageUploader.tsx` (exports
  `MainImageUploader`/`GalleryUploader`), `ProductWebsitePreview.tsx`.
- **`src/app/dashboard/inventory/actions.ts`** — extended, not rewritten.
  `createProduct`/`updateProduct`/`deleteProduct` are byte-for-byte
  unchanged. Added: `updateProductWebsiteDetails`, `uploadProductMainImage`,
  `removeProductMainImage`, `uploadProductGalleryImage`,
  `removeProductGalleryImage`. Every one of these re-fetches the product's
  current website details server-side before calling the RPC and only
  overwrites the field(s) it owns — see the file's own comment block for
  why (short version: it keeps "edit the description" and "upload a
  gallery photo" fully independent, regardless of which order two staff
  actions land in).
- **`src/lib/products.ts`** — `getProducts()`/`getProduct()` now
  select/map the 15 new columns into a `website: ProductWebsiteDetails`
  field on `Product`. `Product` itself gained that field.
- **`src/lib/websiteCatalogueOptions.ts`** (new) — the category/brand
  suggestion lists from the spec, plus category-based specification
  starter templates. Pure UI convenience (`<datalist>` suggestions +
  pre-seeded spec rows) — `products.category`/`products.brand` remain
  plain `text` columns with no enum, so admins can always type something
  not on these lists.
- **`src/components/sales-catalogue/CatalogueGrid.tsx`** — its
  `Omit<Product, "costPrice" | "supplier">` type also now omits
  `"website"`. Sales Catalogue (visible to every signed-in staff member,
  not just admins) never needed website fields and this keeps that page's
  payload exactly as narrow as it was before — the same reasoning that
  already excluded `costPrice`/`supplier` there, just extended to cover
  the new field.

## Public fields exposed (via `website_catalogue` / `get_website_catalogue_by_branch`)

`id, sku, name, brand, model, category, unit, short_description,
full_description, website_price, website_slug, product_image_url,
gallery_image_urls, specifications, warranty_text, is_featured_on_website,
website_display_order, is_combo_eligible, calculator_eligible`, plus
`total_stock_quantity`/`stock_status` (view) or
`branch_id, branch_name, branch_quantity, branch_stock_status` (RPC).

## Sensitive fields hidden

`cost_price`, `selling_price`, `reorder_level`, `supplier`,
`quantity_in_stock` (the company-wide aggregate — deliberately not exposed
either, only the safe `total_stock_quantity`/branch quantity derived from
`product_stock`), `created_at`, `updated_at`, every `profiles` column
(staff data), every `stock_movements` row (audit history), and internal
notes (there is no internal-notes field on `products` today, so there was
nothing to add an exclusion for — noted here so it's obvious this wasn't
overlooked). Neither the view nor either function ever selects these
columns, so there's no code path through this feature that can leak them
regardless of caller role.

## Security rules

- `anon` and non-admin `authenticated` callers: read-only, and only
  through `website_catalogue` / `get_website_catalogue_by_branch()` — no
  grant on `products` or `product_stock` themselves changed (both were
  already `authenticated`-only for `SELECT`, unchanged by this migration).
- Only `is_admin()` callers can execute `update_product_website_details()`
  — enforced inside the function itself (`raise exception` if not admin),
  not just by the grant list, so even a crafted direct RPC call from a
  non-admin's valid session is rejected by Postgres, not just hidden by
  the UI.
- `product-images` Storage: public read (by design — product photos are
  meant to be public), admin-only write, enforced by Storage RLS policies
  using the same `public.is_admin()` helper as everything else.
- `get_website_catalogue_by_branch()` rejects unknown branch ids and
  non-`active` branches (Ilorin is `coming_soon`) with a Postgres
  exception rather than silently returning empty/wrong data.

## Known limitations

- **Pre-existing, not introduced by this migration**: `products`' own
  `UPDATE`/`INSERT` RLS policies (from `0003_products.sql`, never
  tightened) are `to authenticated using (true)` — i.e. any signed-in
  staff member, not just admins, technically *can* write to `products`
  directly via the client SDK, bypassing `create_product()`/
  `update_product()`'s `is_admin()` checks, if they crafted the request
  themselves rather than going through the UI or those functions. The same
  is true for `SELECT` — a non-admin staff session can read `cost_price`
  directly with `supabase.from('products').select('cost_price')`, even
  though the UI never shows it to them. This predates Stage 2 by many
  migrations and is out of scope for the Website Catalogue specifically —
  flagging it here because `scripts/verify-website-catalogue.mjs`
  surfaces it as an informational (not blocking) check when staff
  credentials are supplied. Fixing it would mean tightening `products`'
  base RLS policies in a *new* migration, which is a larger, cross-cutting
  change (would need auditing every existing authenticated write path,
  e.g. Stock Movement/Daily Sales, that currently relies on broad
  `authenticated` access to related tables) — better scoped as its own
  piece of work than folded into this one.
- `website_catalogue`/`get_website_catalogue_by_branch()` are not called
  by this app or by the public website yet — they exist as the contract
  the separate public-site project will consume in a later stage.
- No image re-ordering within the gallery (append/remove only — the array
  order is upload order).
- No slug auto-generation from the product name — admins type it by hand.
- Specifications are unstructured per-category text (no per-category
  required-fields validation) — the Specification Editor's category
  templates are just starter suggestions, not enforcement.

## Deferred features (explicitly out of scope for this stage)

Checkout, Paystack, customer accounts, carts, orders, stock reservations,
combo packages, store credit, and the advanced load calculator — per the
task brief. `is_combo_eligible`/`calculator_eligible` exist as plain flags
with no feature behind them yet.

## Applying the migration

This project has no Supabase CLI project link — every migration to date
has been applied by hand via the Supabase dashboard's SQL Editor (see
README.md "Database Setup"), and `0028_website_catalogue.sql` follows the
same path:

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste the contents of `supabase/migrations/0028_website_catalogue.sql`
   and run it.
3. Confirm in **Table Editor → products** that the 15 new columns exist.
4. Confirm in **Storage** that `product-images` exists, is public, and has
   the size/type limits set.
5. Run `node scripts/verify-website-catalogue.mjs` (see below).

I did not apply this migration myself: I only have the anon/publishable
key (`.env.local`), not the database's `service_role` key or a direct
Postgres connection, and this project's own convention is intentionally to
never put the `service_role` key in this app's reach (see
`0011_staff_management.sql`'s comment on why). Applying schema changes
against a live production database is exactly the kind of action that
belongs in your hands, via the same dashboard flow you've used for the
prior 27 migrations.

## Security tests performed

`scripts/verify-website-catalogue.mjs` — anon-key only, safe/read-only
where the migration isn't applied yet, run against the live project before
`0028` was applied (confirms the *baseline* this migration builds on top
of):

```
PASS  Anonymous users cannot read the full products table
PASS  Anonymous users cannot read the full product_stock table
SKIP  (8 checks) — migration 0028 not applied yet
SKIP  Owner/Admin can update website details — no admin test credentials supplied
SKIP  Manager/Salesperson cannot update website details — no staff test credentials supplied
```

After you apply the migration, re-run it — the 8 currently-skipped checks
(view reachable + never leaks cost/selling/reorder/supplier, hidden/
inactive products excluded, Abuja/Minna return their own stock, zero stock
→ `out_of_stock`, invalid/inactive branch rejected, anon cannot call
`update_product_website_details`) should all flip to `PASS`. To also run
the two role-based checks (Owner/Admin can update; Manager/Salesperson
cannot), set `BMS_TEST_ADMIN_EMAIL`/`BMS_TEST_ADMIN_PASSWORD` and/or
`BMS_TEST_STAFF_EMAIL`/`BMS_TEST_STAFF_PASSWORD` as local environment
variables first (never pass credentials as command-line arguments or
commit them) — the script signs in with them, runs one harmless
no-op-equivalent update, and never prints the password back.

Also manually verify once staff credentials are available:

- Duplicate slug is rejected: give two products the same
  `website_slug` from the Website Details tab — the second save should
  show "That website URL slug is already used by another product."
- `product-images` upload policies: as a non-admin, confirm the file
  input in Website Details never renders (page-level `role !== "admin"`
  gate) — and, if you want to confirm the database-level policy too (not
  just the UI), that a direct `supabase.storage.from('product-images').upload(...)`
  call from a non-admin session is rejected by Storage RLS.
