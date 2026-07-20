import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  supplier: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_stock?: { quantity: number }[];
}

function mapRow(row: ProductRow, branchId: string): Product {
  const branchQuantity =
    branchId === "all" ? row.quantity_in_stock : (row.product_stock?.[0]?.quantity ?? 0);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    quantityInStock: branchQuantity,
    reorderLevel: row.reorder_level,
    supplier: row.supplier,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * branchId "all" (the default) returns each product's company-wide
 * aggregate (products.quantity_in_stock, a trigger-maintained cache -- see
 * 0018_per_branch_stock.sql). Any other branch id returns that branch's
 * real quantity from product_stock instead, defaulting to 0 if the
 * product has no stock at that branch at all.
 */
export async function getProducts(branchId: string = "all"): Promise<Product[]> {
  const supabase = await createClient();
  const baseColumns =
    "id, sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, supplier, is_active, created_at, updated_at";
  let query = supabase
    .from("products")
    .select(branchId === "all" ? baseColumns : `${baseColumns}, product_stock(quantity)`)
    .order("name");

  if (branchId !== "all") {
    query = query.eq("product_stock.branch_id", branchId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load products:", error?.message);
    return [];
  }

  return (data as unknown as ProductRow[]).map((row) => mapRow(row, branchId));
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, category, unit, cost_price, selling_price, quantity_in_stock, reorder_level, supplier, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapRow(data as ProductRow, "all");
}

/**
 * Every product's stock at every branch, as a nested map:
 * { [productId]: { [branchId]: quantity } }. Used where a form needs to
 * show/validate against a specific branch's stock chosen interactively
 * (e.g. Record Sale's branch selector) rather than one fixed branch
 * decided ahead of time on the server.
 */
export async function getProductStockByBranch(): Promise<Record<string, Record<string, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_stock").select("product_id, branch_id, quantity");

  if (error || !data) {
    console.warn("Failed to load per-branch product stock:", error?.message);
    return {};
  }

  const map: Record<string, Record<string, number>> = {};
  for (const row of data as { product_id: string; branch_id: string; quantity: number }[]) {
    (map[row.product_id] ??= {})[row.branch_id] = row.quantity;
  }
  return map;
}
