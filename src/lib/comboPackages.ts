import { createClient } from "@/lib/supabase/server";
import type { ComboPackage, ComboPackageComponent, ComboComponentType } from "@/types";

interface ComboPackageComponentRow {
  id: string;
  product_id: string | null;
  quantity: number;
  component_type: ComboComponentType;
  is_required: boolean;
  display_name: string;
  display_order: number;
  products: { name: string } | null;
}

interface ComboPackageRow {
  id: string;
  package_code: string;
  name: string;
  website_slug: string;
  short_description: string | null;
  full_description: string | null;
  main_image_url: string | null;
  gallery_image_urls: string[] | null;
  final_price: number | string;
  system_capacity_text: string | null;
  capacity_rank: number;
  appliances_supported: string[] | null;
  installation_scope: string | null;
  warranty_text: string | null;
  inspection_required: boolean;
  is_active: boolean;
  is_visible_on_website: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  combo_package_components: ComboPackageComponentRow[];
}

const SELECT_COLUMNS = `
  id, package_code, name, website_slug, short_description, full_description, main_image_url,
  gallery_image_urls, final_price, system_capacity_text, capacity_rank, appliances_supported,
  installation_scope, warranty_text, inspection_required, is_active, is_visible_on_website,
  is_featured, display_order, created_at, updated_at,
  combo_package_components (id, product_id, quantity, component_type, is_required, display_name, display_order, products(name))
`;

function mapComponent(row: ComboPackageComponentRow): ComboPackageComponent {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name ?? null,
    quantity: row.quantity,
    componentType: row.component_type,
    isRequired: row.is_required,
    displayName: row.display_name,
    displayOrder: row.display_order,
  };
}

function mapRow(row: ComboPackageRow): ComboPackage {
  return {
    id: row.id,
    packageCode: row.package_code,
    name: row.name,
    websiteSlug: row.website_slug,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    mainImageUrl: row.main_image_url,
    galleryImageUrls: row.gallery_image_urls ?? [],
    finalPrice: Number(row.final_price),
    systemCapacityText: row.system_capacity_text,
    capacityRank: row.capacity_rank,
    appliancesSupported: row.appliances_supported ?? [],
    installationScope: row.installation_scope,
    warrantyText: row.warranty_text,
    inspectionRequired: row.inspection_required,
    isActive: row.is_active,
    isVisibleOnWebsite: row.is_visible_on_website,
    isFeatured: row.is_featured,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    components: (row.combo_package_components ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(mapComponent),
  };
}

/** Readable by any authenticated staff member (Managers/salespeople
 * included) -- see combo_packages' "Staff can read all combo packages"
 * RLS policy in 0031_combo_packages_installations_refunds_credit.sql.
 * Only create_combo_package/update_combo_package/set_combo_package_status
 * (all Owner/Admin-gated inside the function) can ever write. */
export async function getComboPackages(): Promise<ComboPackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("combo_packages")
    .select(SELECT_COLUMNS)
    .order("display_order", { ascending: true });

  if (error || !data) {
    console.warn("Failed to load combo packages:", error?.message);
    return [];
  }

  return (data as unknown as ComboPackageRow[]).map(mapRow);
}

export async function getComboPackage(id: string): Promise<ComboPackage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("combo_packages").select(SELECT_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  return mapRow(data as unknown as ComboPackageRow);
}

export interface ComboPackageProfit {
  finalPrice: number;
  componentCost: number;
  estimatedProfit: number;
}

/** Owner/Admin only -- get_combo_package_profit() raises for anyone else. */
export async function getComboPackageProfit(id: string): Promise<ComboPackageProfit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_combo_package_profit", { p_package_id: id });

  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    finalPrice: Number(row.final_price),
    componentCost: Number(row.component_cost),
    estimatedProfit: Number(row.estimated_profit),
  };
}
