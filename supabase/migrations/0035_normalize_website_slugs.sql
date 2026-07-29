-- Fixes a real bug: products.website_slug, combo_packages.website_slug,
-- and installation_projects.website_slug were only ever trimmed before
-- being saved (create_product_website_details/create_combo_package/
-- create_installation_project and their update_ counterparts), never
-- actually slugified. The BMS forms pre-fill a slugified default, but
-- staff can type over it, and any data saved before that default existed
-- could already be non-slug-shaped -- e.g. "Cworth 15kW Lithium Battery"
-- saved verbatim, which breaks that exact product's own /shop/[slug]
-- page on the website (the raw name, spaces and all, ends up in the
-- URL). The corresponding Server Actions now slugify server-side before
-- ever calling these RPCs, so this can't recur through the app -- this
-- migration (1) repairs any rows already saved with a bad slug, and (2)
-- adds a CHECK constraint so a bad slug can't get back in some other
-- way (e.g. a hand-run SQL Editor query) without being caught outright.

-- ---------------------------------------------------------------------
-- 1. Backfill: normalize any existing non-slug-shaped values
-- ---------------------------------------------------------------------
-- Same transformation as the app's slugify(): lowercase, non-alphanumeric
-- runs collapsed to a single hyphen, no leading/trailing hyphen.

update public.products
set website_slug = nullif(
  regexp_replace(regexp_replace(lower(btrim(website_slug)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'),
  ''
)
where website_slug is not null
  and website_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';

update public.combo_packages
set website_slug = regexp_replace(regexp_replace(lower(btrim(website_slug)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
where website_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';

update public.installation_projects
set website_slug = regexp_replace(regexp_replace(lower(btrim(website_slug)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
where website_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';

-- ---------------------------------------------------------------------
-- 2. Guardrail: reject anything non-slug-shaped going forward
-- ---------------------------------------------------------------------
-- If either backfill above hit a collision on the *_website_slug_key
-- unique constraint (two different bad values normalizing to the same
-- slug), this migration stops there with a clear duplicate-key error --
-- resolve it by manually renaming one of the conflicting rows' slug,
-- then re-run.

alter table public.products
  add constraint products_website_slug_format check (website_slug is null or website_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.combo_packages
  add constraint combo_packages_website_slug_format check (website_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.installation_projects
  add constraint installation_projects_website_slug_format check (website_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
