-- Expenses: per-branch operational costs. Unlike stock_movements/sales,
-- expenses are plain editable/deletable records (Products/Customers
-- pattern) rather than an append-only ledger -- there's no downstream
-- atomic calculation tied to an individual expense row, so correcting a
-- data-entry mistake in place is more practical than reversing entries.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches (id),
  category text not null,
  description text,
  amount numeric(14, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

-- No role enforcement yet (see README) -- any signed-in staff member has
-- full access, same as products/customers.
create policy "Authenticated users can read expenses"
  on public.expenses for select to authenticated using (true);

create policy "Authenticated users can insert expenses"
  on public.expenses for insert to authenticated with check (true);

create policy "Authenticated users can update expenses"
  on public.expenses for update to authenticated using (true);

create policy "Authenticated users can delete expenses"
  on public.expenses for delete to authenticated using (true);

insert into public.expenses (branch_id, category, description, amount, expense_date)
values
  ('abuja', 'Rent', 'Monthly shop rent — Abuja branch', 350000, current_date - interval '3 days'),
  ('abuja', 'Transport', 'Fuel for delivery van', 45000, current_date - interval '1 day'),
  ('minna', 'Utilities', 'Electricity bill', 28000, current_date - interval '5 days'),
  ('minna', 'Salaries', 'Part-time staff wages', 120000, current_date - interval '2 days'),
  ('abuja', 'Maintenance', 'Generator servicing', 65000, current_date - interval '10 days');
