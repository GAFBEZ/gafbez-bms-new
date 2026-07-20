-- System-wide settings (currently just one: the default reorder level
-- pre-filled on new products). A true singleton table: the boolean primary
-- key can only ever be `true`, and the check constraint forbids `false`,
-- so at most one row can ever exist.

create table public.app_settings (
  id boolean primary key default true,
  default_reorder_level integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create policy "Authenticated users can read app settings"
  on public.app_settings
  for select
  to authenticated
  using (true);

create policy "Only admins can update app settings"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
