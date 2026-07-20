-- Notifications: a shared, company-wide notice board -- not a per-user
-- inbox. is_read is a single flag per notification, so marking one as
-- read marks it read for everyone. That's a deliberate simplification for
-- a small internal team; a real per-user "read" state would need a join
-- table (notification_id, user_id) if this ever needs to scale to "seen
-- by me, unseen by you."
--
-- Manual creation only for now -- automatic alerts (e.g. low stock on
-- crossing the reorder threshold) would mean modifying the already-tested
-- record_sale()/record_stock_movement() functions, which is deliberately
-- deferred rather than risking a regression in those for this pass.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'info' check (type in ('info', 'warning', 'success')),
  message text not null,
  is_read boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Authenticated users can read notifications"
  on public.notifications
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (true);

-- Marking read/unread is low-risk and reversible, so it's open to any
-- signed-in staff member (not admin-gated, unlike delete elsewhere).
create policy "Authenticated users can update notifications"
  on public.notifications
  for update
  to authenticated
  using (true);

insert into public.notifications (type, message, is_read)
values
  ('info', 'Welcome to GAFBEZ Energies Business Management System.', true),
  ('warning', '5kVA Hybrid Inverter is running low on stock at Abuja Branch.', false),
  ('success', 'Daily Sales module is now live — record sales directly from the dashboard.', false);
