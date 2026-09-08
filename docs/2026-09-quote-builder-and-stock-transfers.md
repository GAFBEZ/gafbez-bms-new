# Quote Builder PDF, Data Isolation, and Stock Transfers

Notes on a batch of related work from September 2026, written for future reference -- what changed, why, and how to check it's still working. This is documentation only; nothing here affects how the app runs.

Companion doc in the website repo (`gafbeznewweb/docs/2026-09-quote-builder-pdf.md`) covers the installer-facing side of the same Quote Builder work.

---

## 1. Data isolation fix (RLS)

**What was wrong:** An admin testing the installer Quote Builder on the website could see their test installer's saved line items show up in BMS's own "Manage Saved Items" list. The cause: `quote_saved_items` and `quote_templates` are documented as strictly personal, per-owner data, but their database read-permission rules (`SELECT` policies) had a blanket `or is_admin()` clause -- any admin could read *any* owner's rows, contradicting that design.

**The fix** (`supabase/migrations/0063_fix_quote_data_isolation.sql`):
- `quote_saved_items` and `quote_templates`: removed the admin bypass entirely. Now strictly `owner_id = auth.uid()` -- only the row's own owner can read it, full stop.
- `quotes`: narrowed (not removed) the admin bypass to `is_admin() and owner_role = 'staff'` -- an admin can still see other staff members' issued quotes (legitimate oversight, same as other staff/sales data), but can never see an installer's quotes from the public website.

**How to verify it's still correct:** As an admin, save an item as a *different, non-admin installer* on the website's Quote Builder, then check BMS's Quote Builder "Manage Saved Items" list -- it should not appear there. Also worth spot-checking that BMS admins can still see other staff members' saved quotes in `quotes` (that part is still intentionally shared).

---

## 2. Server-side PDF generation for the Quote Builder

**The problem this solves:** The "Print / Save PDF" button uses the browser's own print engine (`window.print()`), and different phones/browsers were producing inconsistent output -- blank pages, orphaned lines, crushed layout -- despite several rounds of CSS fixes. The only way to guarantee identical output everywhere is to have one single, controlled browser render the PDF on the server, for everyone, instead of trusting each device's own browser.

**How it works:** A new "Download PDF (Mobile)" button (`src/components/quote-builder/QuoteBuilder.tsx`) saves the quote (same as "Save Quote"), then downloads it from a new route:
1. `src/app/api/quote-builder/pdf/route.ts` -- authenticates the caller, loads the saved quote, launches a headless Chromium instance, and has it navigate to...
2. `src/app/dashboard/quote-builder/[id]/print-preview/page.tsx` -- an internal-only page (never linked to directly) that renders the exact same `QuoteBuilder` component, pre-filled with the saved quote, in read-only form. The original request's session cookie is forwarded to Chromium so it loads this page as the same logged-in staff member -- no separate login or signed link needed.
3. Chromium emulates print media and calls `page.pdf()`, honoring the exact same `@page`/print CSS already used by the regular print button (`globals.css`) -- so this doesn't duplicate or fight with that styling, it just renders it consistently.

The existing "Print / Save PDF" button is completely unchanged -- this is a second, additional option, not a replacement.

**Two real bugs hit and fixed along the way**, both worth knowing about if this route ever breaks again after a dependency update:

- **Chromium binary missing from the deployed bundle.** Vercel only bundles files a route's code provably touches, and `@sparticuz/chromium` (the Chromium build made for serverless environments) loads its binary from disk at runtime rather than importing it directly -- so Vercel left it out entirely, and the route failed in production despite working in local dev (which uses a full local Chrome install instead). Fixed in `next.config.ts` via `serverExternalPackages` + `outputFileTracingIncludes` pointing at `node_modules/@sparticuz/chromium/bin/**/*`. If this route ever silently fails again after an unrelated dependency bump, check first whether this config still correctly includes that path (you can confirm by checking `.next/server/app/api/quote-builder/pdf/route.js.nft.json` after a build -- it should list `sparticuz/chromium/bin/chromium.br` and friends).
- **The Naira sign (₦) rendered as a blank box.** This app's font (Geist) doesn't include that glyph in the subset being loaded. Invisible on a real phone/laptop, because the operating system quietly substitutes another installed font for the one missing character -- but the server's minimal, sandboxed PDF-rendering environment has no such fallback font library at all. Fixed by adding Noto Sans (confirmed to include ₦) as a self-hosted fallback font (`src/app/layout.tsx`, chained into `globals.css`'s `--font-sans`). If a different missing-glyph "tofu box" ever shows up in a PDF again (a different currency symbol, an emoji, etc.), this is the same class of bug -- check whether the missing character exists in the current font stack, and extend the fallback if not.

**How to verify it's still working:** Build a test quote, click "Download PDF (Mobile)" from both a laptop and an actual phone -- confirm both produce an identical, correctly paginated PDF with the ₦ symbol rendering correctly (not a blank box).

---

## 3. Transfer Stock between branches

**The problem this solves:** Moving inventory from one branch to another (e.g. 3 inverters from Abuja to Minna) previously required two separate, disconnected entries on the Stock Movement page -- a "Stock Out" at the source and a manual "Stock In" at the destination. Easy to forget the second step or mistype the quantity, and a lone "Stock Out" reads ambiguously in the ledger (could be confused with a sale or any other stock reduction).

Investigated first and confirmed: a "Stock Out" has **no accounting/financial effect** today -- revenue and profit are computed only from `sales`/`sale_items`, never from `stock_movements`. So the real issue was atomicity and ledger clarity, not the books.

**The fix:**
- `supabase/migrations/0065_stock_transfers.sql` adds `record_stock_transfer()`, a database function that moves stock between two branches in one atomic transaction: decrements `product_stock` at the source, increments it at the destination, and inserts *two* linked `stock_movements` rows (one `out`, one `in`, sharing a new `transfer_id` column) with reason text that spells out exactly what happened -- e.g. "Transfer to GAFBEZ Energies Minna Branch" / "Transfer from GAFBEZ Energies Abuja Branch" -- so it never looks like an ordinary, unexplained stock reduction.
- Deliberately reuses the existing `in`/`out` movement types rather than adding a new `transfer` type, so the Stock Movement history table needed zero changes to display it correctly.
- **Permission:** Owner (admin) or a branch Manager only -- stricter than ordinary Stock In/Out (any staff, locked to their own branch), since a transfer touches two branches' books at once. Enforced inside the database function itself, not just hidden in the UI -- a direct API call from a non-admin/non-manager account is rejected the same way a UI click would be.
- New page: `/dashboard/stock-movement/transfer`, reachable via a "Transfer Stock" button next to "Record Movement" (only shown to Owner/Manager accounts).

**How to verify it's still working:** As an Owner/Manager, transfer a small quantity between two branches and confirm both branches' stock counts update correctly, and two new rows appear in Stock Movement history with the "Transfer to/from" wording. As a regular staff account, confirm the "Transfer Stock" button doesn't appear, and that visiting `/dashboard/stock-movement/transfer` directly shows "Owner/Manager only" instead of the form.
