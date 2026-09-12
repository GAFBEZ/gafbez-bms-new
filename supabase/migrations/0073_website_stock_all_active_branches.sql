-- get_website_catalogue_by_branch() computed stock as `ps.branch_id =
-- p_branch_id` only -- since the website always calls this with
-- p_branch_id = 'abuja' (see gafbeznewweb's DEFAULT_BRANCH_ID), stock
-- recorded at Minna never counted towards what customers see, even
-- though both offices now share one phone/WhatsApp line and are
-- effectively run as one storefront.
--
-- Changes the quantity/status columns to sum product_stock across every
-- ACTIVE branch (abuja + minna today; ilorin stays excluded, since it's
-- still 'coming_soon' -- see 0001_branches.sql) instead of just
-- p_branch_id. Everything else is unchanged: p_branch_id still has to
-- name a real, active branch (still 'abuja' from the website), and the
-- returned branch_id/branch_name still identify that branch, since
-- orders/pickup/contact all still nominally belong to it.
--
-- Note this only affects what customers SEE as in-stock and what
-- quantities the cart will accept -- record_sale/record_return/
-- confirm_whatsapp_order etc. still reserve and deduct stock from a
-- SPECIFIC branch's product_stock row (still only Abuja's, for the
-- website's orders), same as before. If a product's stock is only
-- sitting at Minna, an order for it will now be accepted at checkout
-- but will need that stock physically transferred to Abuja (Stock
-- Movement > Transfer) before staff can confirm/fulfill it.
--
-- Same technique as 0069/0070/etc: CREATE OR REPLACE with an unchanged
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
      select ps.product_id, sum(ps.quantity) as total_quantity
      from public.product_stock ps
      join public.branches b on b.id = ps.branch_id and b.status = 'active'
      group by ps.product_id
    ) s on s.product_id = p.id
    where p.is_active = true and p.is_visible_on_website = true
    order by p.website_display_order, p.name;
end;
$$;
