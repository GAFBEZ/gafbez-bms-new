-- Dedicated homepage hero background photos, decoupled from Installation
-- Projects. Previously the homepage hero rotator reused whichever
-- installation projects were flagged "Featured" (0033) -- that meant
-- staff had no way to pick a photo for the hero without also making it
-- a featured case study on /installations, and vice versa, and the
-- rotator inherited that gallery's title/location/description caption
-- overlay, which visually collided with the homepage's own hero copy.
-- public.hero_images below is a plain, purpose-built list of photos with
-- no caption fields at all -- upload/reorder/remove only, admin-managed
-- the same way the branding logo (0020_logo_upload.sql) is.

-- ---------------------------------------------------------------------
-- 1. hero_images
-- ---------------------------------------------------------------------

create table public.hero_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null check (btrim(image_url) <> ''),
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hero_images is 'Homepage hero background photos, admin-managed (Settings), independent of installation_projects. Existence in this table means visible -- no separate visibility flag, same as the installation project gallery.';

create trigger set_hero_images_updated_at
  before update on public.hero_images
  for each row execute procedure public.set_updated_at();

alter table public.hero_images enable row level security;

create policy "Anyone can read hero images"
  on public.hero_images
  for select
  to anon, authenticated
  using (true);

-- Deliberately no insert/update/delete policy -- all writes go through
-- the SECURITY DEFINER functions below, same convention as every table
-- since Stage 6.
grant select on public.hero_images to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Admin-only CRUD functions
-- ---------------------------------------------------------------------
-- Admin-only (public.is_admin()), not
-- can_manage_installation_projects()'s broader Owner/Manager set -- this
-- is homepage branding content, same permission level as the logo
-- (0020_logo_upload.sql), not a marketing case study any Manager curates.

create function public.create_hero_image(p_image_url text)
returns public.hero_images
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_next_order integer;
  v_row public.hero_images;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner can manage homepage background photos';
  end if;

  v_url := nullif(btrim(p_image_url), '');
  if v_url is null then
    raise exception 'An image URL is required';
  end if;

  select coalesce(max(display_order) + 1, 0) into v_next_order from public.hero_images;

  insert into public.hero_images (image_url, display_order, created_by)
  values (v_url, v_next_order, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_hero_image(text) from public;
grant execute on function public.create_hero_image(text) to authenticated;

create function public.delete_hero_image(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the Owner can manage homepage background photos';
  end if;

  delete from public.hero_images where id = p_id;

  if not found then
    raise exception 'Hero image not found';
  end if;
end;
$$;

revoke all on function public.delete_hero_image(uuid) from public;
grant execute on function public.delete_hero_image(uuid) to authenticated;

create function public.set_hero_image_display_order(p_id uuid, p_display_order integer)
returns public.hero_images
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.hero_images;
begin
  if not public.is_admin() then
    raise exception 'Only the Owner can manage homepage background photos';
  end if;

  if p_display_order < 0 then
    raise exception 'Display order must be zero or greater';
  end if;

  update public.hero_images
    set display_order = p_display_order
    where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Hero image not found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_hero_image_display_order(uuid, integer) from public;
grant execute on function public.set_hero_image_display_order(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. hero-images Storage bucket
-- ---------------------------------------------------------------------
-- Same shape as `branding` (0020_logo_upload.sql): public read, admin-only
-- write -- not Owner/Manager like installation-images, since this is
-- homepage branding, not marketing case-study content.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hero-images',
  'hero-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read hero images bucket"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'hero-images');

create policy "Only admins can upload hero images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'hero-images' and public.is_admin());

create policy "Only admins can update hero images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'hero-images' and public.is_admin())
  with check (bucket_id = 'hero-images' and public.is_admin());

create policy "Only admins can delete hero images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'hero-images' and public.is_admin());
