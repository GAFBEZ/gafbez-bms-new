-- Customers: contact records plus a manually-tracked outstanding balance.
-- outstanding_balance is a plain editable number for now, not derived from
-- invoices/payments -- it becomes computed once a Daily Sales/invoicing
-- module exists. No uniqueness enforced on phone/email/name since
-- real-world customer data is messy; avoid friction over correctness here.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  branch_id text references public.branches (id),
  outstanding_balance numeric(14, 2) not null default 0 check (outstanding_balance >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

-- No role enforcement yet (see README) -- any signed-in staff member has
-- full access, same as products.
create policy "Authenticated users can read customers"
  on public.customers
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert customers"
  on public.customers
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update customers"
  on public.customers
  for update
  to authenticated
  using (true);

create policy "Authenticated users can delete customers"
  on public.customers
  for delete
  to authenticated
  using (true);

-- Reuses the set_updated_at() function created in 0003_products.sql.
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

insert into public.customers (name, phone, email, branch_id, outstanding_balance)
values
  ('Bala Solar Distributors', '+2348012345001', 'bala@balasolar.example.com', 'abuja', 452000),
  ('Chika Renewable Supplies', '+2348012345002', 'chika@chikarenewables.example.com', 'minna', 0),
  ('Femi Power Solutions', '+2348012345003', 'femi@femipower.example.com', 'abuja', 185000),
  ('Grace Energy Hub', '+2348012345004', 'grace@graceenergy.example.com', 'ilorin', 0);
