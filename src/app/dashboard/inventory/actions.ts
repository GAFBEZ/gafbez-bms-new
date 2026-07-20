"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ProductFormState {
  error: string | null;
}

interface ParsedProductMetadata {
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  supplier: string | null;
  isActive: boolean;
}

function parseProductMetadata(formData: FormData): ParsedProductMetadata | null {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "unit";
  const costPrice = Number(formData.get("costPrice"));
  const sellingPrice = Number(formData.get("sellingPrice"));
  const reorderLevel = Number(formData.get("reorderLevel"));
  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";

  if (!sku || !name || !category) return null;
  if ([costPrice, sellingPrice, reorderLevel].some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }

  return { sku, name, category, unit, costPrice, sellingPrice, reorderLevel, supplier, isActive };
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = parseProductMetadata(formData);
  const quantityInStock = Number(formData.get("quantityInStock"));
  const branchId = String(formData.get("branchId") ?? "").trim();

  if (!parsed || !branchId || !Number.isFinite(quantityInStock) || quantityInStock < 0) {
    return {
      error:
        "Fill in SKU, name, category, and branch, and make sure prices/quantities are zero or greater.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_product", {
    p_sku: parsed.sku,
    p_name: parsed.name,
    p_category: parsed.category,
    p_unit: parsed.unit,
    p_cost_price: parsed.costPrice,
    p_selling_price: parsed.sellingPrice,
    p_quantity_in_stock: quantityInStock,
    p_reorder_level: parsed.reorderLevel,
    p_is_active: parsed.isActive,
    p_branch_id: branchId,
    p_supplier: parsed.supplier,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `SKU "${parsed.sku}" is already in use.` };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movement");
  redirect("/dashboard/inventory");
}

export async function updateProduct(
  id: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = parseProductMetadata(formData);
  if (!parsed) {
    return {
      error: "Fill in SKU, name, and category, and make sure prices are zero or greater.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_product", {
    p_id: id,
    p_sku: parsed.sku,
    p_name: parsed.name,
    p_category: parsed.category,
    p_unit: parsed.unit,
    p_cost_price: parsed.costPrice,
    p_selling_price: parsed.sellingPrice,
    p_reorder_level: parsed.reorderLevel,
    p_is_active: parsed.isActive,
    p_supplier: parsed.supplier,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `SKU "${parsed.sku}" is already in use.` };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/dashboard/inventory");
}
