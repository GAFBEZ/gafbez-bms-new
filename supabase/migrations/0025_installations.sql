-- Installation jobs: what a customer was charged for a solar install vs.
-- what the parts + labor actually cost, so profit per job is visible.
-- Plain editable/deletable record (Expenses pattern), not an append-only
-- ledger -- there's no stock deduction tied to a row (the product pickers
-- are for pulling in a price snapshot only), so correcting a mistake in
-- place is fine. product_id columns use "on delete set null" rather than
-- restrict/cascade so retiring a product later never blocks deleting it or
-- silently destroys installation history.

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches (id),
  installation_date date not null default current_date,
  total_charged numeric(14, 2) not null check (total_charged >= 0),

  inverter_product_id uuid references public.products (id) on delete set null,
  inverter_price numeric(14, 2) not null default 0 check (inverter_price >= 0),
  inverter_qty integer not null default 1 check (inverter_qty >= 0),

  solar_panel_product_id uuid references public.products (id) on delete set null,
  solar_panel_price numeric(14, 2) not null default 0 check (solar_panel_price >= 0),
  solar_panel_qty integer not null default 1 check (solar_panel_qty >= 0),

  battery_product_id uuid references public.products (id) on delete set null,
  battery_price numeric(14, 2) not null default 0 check (battery_price >= 0),
  battery_qty integer not null default 1 check (battery_qty >= 0),

  cable_amount numeric(14, 2) not null default 0 check (cable_amount >= 0),
  accessories_amount numeric(14, 2) not null default 0 check (accessories_amount >= 0),
  installation_amount numeric(14, 2) not null default 0 check (installation_amount >= 0),

  cost_total numeric(14, 2) generated always as (
    (inverter_price * inverter_qty)
      + (solar_panel_price * solar_panel_qty)
      + (battery_price * battery_qty)
      + cable_amount + accessories_amount + installation_amount
  ) stored,

  profit numeric(14, 2) generated always as (
    total_charged
      - (
        (inverter_price * inverter_qty)
          + (solar_panel_price * solar_panel_qty)
          + (battery_price * battery_qty)
          + cable_amount + accessories_amount + installation_amount
      )
  ) stored,

  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.installations enable row level security;

create policy "Authenticated users can read installations"
  on public.installations for select to authenticated using (true);

create policy "Authenticated users can insert installations"
  on public.installations for insert to authenticated with check (true);

create policy "Authenticated users can update installations"
  on public.installations for update to authenticated using (true);

create policy "Only admins can delete installations"
  on public.installations for delete to authenticated using (public.is_admin());
