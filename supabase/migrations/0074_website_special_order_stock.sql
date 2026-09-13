-- Special Order Quantity (0036) already lets an admin say "I can get N
-- of this quickly even with zero physical stock", and get_available_to_
-- sell()/the order-placement RPCs already honour it -- but the public
-- website's own stock check (get_website_catalogue_by_branch, most
-- recently touched by 0073) only ever summed physical quantity, so a
-- special-order item still showed "Out of Stock" and was blocked from
-- purchase on the shop, same as if nothing had been set.
--
-- Sums greatest(quantity, special_order_quantity) per branch instead of
-- quantity alone (same greatest() rule 0036 already uses for
-- get_available_to_sell()), then across every active branch as before.
-- By request, this makes a special-order item look and behave exactly
-- like ordinary in-stock inventory on the website -- no separate
-- "special order"/"ships in X hours" badge.
--
-- Same technique as 0069/etc: CREATE OR REPLACE with an unchanged
-- signature, no drop needed.
create or replace function public.get_website_catalogue_by_branch(p_branch_id text)
returns table (
  id uuid,
  sku text,
  name text,
  brand text,
  model text,
  category text,
  unit text,
  short_description text,
  full_description text,
  website_price numeric,
  website_slug text,
  product_image_url text,
  gallery_image_urls jsonb,
  specifications jsonb,
  warranty_text text,
  is_featured_on_website boolean,
  website_display_order integer,
  is_combo_eligible boolean,
  calculator_eligible boolean,
  branch_id text,
  branch_name text,
  branch_quantity integer,
  branch_stock_status text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_branch_name text;
  v_branch_status text;
begin
  select b.name, b.status into v_branch_name, v_branch_status
    from public.branches b
    where b.id = p_branch_id;

  if not found then
    raise exception 'Unknown branch: %', p_branch_id;
  end if;

  if v_branch_status <> 'active' then
    raise exception 'Branch is not active: %', p_branch_id;
  end if;

  return query
    select
      p.id,
      p.sku,
      p.name,
      p.brand,
      p.model,
      p.category,
      p.unit,
      p.short_description,
      p.full_description,
      p.website_price,
      p.website_slug,
      p.product_image_url,
      p.gallery_image_urls,
      p.specifications,
      p.warranty_text,
      p.is_featured_on_website,
      p.website_display_order,
      p.is_combo_eligible,
      p.calculator_eligible,
      p_branch_id,
      v_branch_name,
      coalesce(s.total_quantity, 0)::integer,
      case when coalesce(s.total_quantity, 0) > 0 then 'in_stock' else 'out_of_stock' end
    from public.products p
    left join (
      select
        ps.product_id,
        sum(greatest(ps.quantity, coalesce(ps.special_order_quantity, 0))) as total_quantity
      from public.product_stock ps
      join public.branches b on b.id = ps.branch_id and b.status = 'active'
      group by ps.product_id
    ) s on s.product_id = p.id
    where p.is_active = true and p.is_visible_on_website = true
    order by p.website_display_order, p.name;
end;
$$;
