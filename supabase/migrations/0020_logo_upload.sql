-- Logo upload for Business Profile. Unlike the private `documents`
-- bucket, this one is public (public = true) -- a business logo is meant
-- to be visible everywhere the business name already is, including the
-- pre-login screen, so it's served via Supabase's direct, unsigned public
-- URL rather than a signed one. Marking the bucket public governs that
-- direct-URL read path; the SELECT policy below only matters for
-- API-based access (e.g. this app listing/checking the bucket), not the
-- public URL itself, which bypasses RLS by design once a bucket is public.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "Authenticated users can read branding assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'branding');

-- Upload/replace/delete are admin-only, consistent with everything else
-- that changes shared, company-wide state (Business Profile, Branches).
create policy "Only admins can upload branding assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

create policy "Only admins can update branding assets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

create policy "Only admins can delete branding assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'branding' and public.is_admin());

alter table public.app_settings
  add column logo_path text;
