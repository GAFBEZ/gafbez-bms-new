-- Documents: file storage via a private Supabase Storage bucket, plus a
-- metadata table (documents) for listing, filtering, and delete
-- permission checks without needing to list the bucket itself. The bucket
-- is private (public = false) -- all access goes through RLS on
-- storage.objects, consistent with everything else in this app being
-- authenticated-only. Downloads use short-lived signed URLs generated
-- on demand, not public links.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can read documents in storage"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'documents');

create policy "Authenticated users can upload documents to storage"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'documents');

-- Consistent with the rest of the app: delete is admin-only.
create policy "Only admins can delete documents from storage"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'documents' and public.is_admin());

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  branch_id text references public.branches (id),
  category text,
  size_bytes bigint,
  content_type text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Authenticated users can read documents metadata"
  on public.documents
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert documents metadata"
  on public.documents
  for insert
  to authenticated
  with check (true);

create policy "Only admins can delete documents metadata"
  on public.documents
  for delete
  to authenticated
  using (public.is_admin());
