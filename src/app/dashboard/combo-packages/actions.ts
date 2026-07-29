"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import type { ComboComponentType } from "@/types";

export interface ComboPackageFormState {
  error: string | null;
}

interface ParsedComponent {
  productId: string | null;
  quantity: number;
  componentType: ComboComponentType;
  isRequired: boolean;
  displayName: string;
  displayOrder: number;
}

function parseComponents(formData: FormData): ParsedComponent[] | null {
  const raw = formData.get("componentsJson");
  if (typeof raw !== "string" || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return parsed.map((item) => {
      const c = item as Record<string, unknown>;
      return {
        productId: typeof c.productId === "string" && c.productId ? c.productId : null,
        quantity: Number(c.quantity),
        componentType: c.componentType as ComboComponentType,
        isRequired: Boolean(c.isRequired),
        displayName: String(c.displayName ?? ""),
        displayOrder: Number(c.displayOrder ?? 0),
      };
    });
  } catch {
    return null;
  }
}

function toJsonbComponents(components: ParsedComponent[]) {
  return components.map((c) => ({
    product_id: c.productId,
    quantity: c.quantity,
    component_type: c.componentType,
    is_required: c.isRequired,
    display_name: c.displayName,
    display_order: c.displayOrder,
  }));
}

const FORM_ERROR = "Fill in all required fields -- name, slug, price, and at least one component.";

export async function createComboPackage(
  _prevState: ComboPackageFormState,
  formData: FormData,
): Promise<ComboPackageFormState> {
  const components = parseComponents(formData);
  const finalPrice = Number(formData.get("finalPrice"));
  const packageCode = String(formData.get("packageCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const websiteSlug = slugify(String(formData.get("websiteSlug") ?? "").trim());

  if (!components || !packageCode || !name || !websiteSlug || !Number.isFinite(finalPrice) || finalPrice < 0) {
    return { error: FORM_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_combo_package", {
    p_package_code: packageCode,
    p_name: name,
    p_website_slug: websiteSlug,
    p_short_description: String(formData.get("shortDescription") ?? ""),
    p_full_description: String(formData.get("fullDescription") ?? ""),
    p_main_image_url: String(formData.get("mainImageUrl") ?? ""),
    p_gallery_image_urls: [],
    p_final_price: finalPrice,
    p_system_capacity_text: String(formData.get("systemCapacityText") ?? ""),
    p_capacity_rank: Number(formData.get("capacityRank") ?? 0),
    p_appliances_supported: String(formData.get("appliancesSupported") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    p_installation_scope: String(formData.get("installationScope") ?? ""),
    p_warranty_text: String(formData.get("warrantyText") ?? ""),
    p_inspection_required: formData.get("inspectionRequired") === "on",
    p_is_active: formData.get("isActive") === "on",
    p_is_visible_on_website: formData.get("isVisibleOnWebsite") === "on",
    p_is_featured: formData.get("isFeatured") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0),
    p_components: toJsonbComponents(components),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/combo-packages");
  redirect("/dashboard/combo-packages");
}

export async function updateComboPackage(
  id: string,
  _prevState: ComboPackageFormState,
  formData: FormData,
): Promise<ComboPackageFormState> {
  const components = parseComponents(formData);
  const finalPrice = Number(formData.get("finalPrice"));
  const packageCode = String(formData.get("packageCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const websiteSlug = slugify(String(formData.get("websiteSlug") ?? "").trim());

  if (!components || !packageCode || !name || !websiteSlug || !Number.isFinite(finalPrice) || finalPrice < 0) {
    return { error: FORM_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_combo_package", {
    p_id: id,
    p_package_code: packageCode,
    p_name: name,
    p_website_slug: websiteSlug,
    p_short_description: String(formData.get("shortDescription") ?? ""),
    p_full_description: String(formData.get("fullDescription") ?? ""),
    p_main_image_url: String(formData.get("mainImageUrl") ?? ""),
    p_gallery_image_urls: [],
    p_final_price: finalPrice,
    p_system_capacity_text: String(formData.get("systemCapacityText") ?? ""),
    p_capacity_rank: Number(formData.get("capacityRank") ?? 0),
    p_appliances_supported: String(formData.get("appliancesSupported") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    p_installation_scope: String(formData.get("installationScope") ?? ""),
    p_warranty_text: String(formData.get("warrantyText") ?? ""),
    p_inspection_required: formData.get("inspectionRequired") === "on",
    p_is_active: formData.get("isActive") === "on",
    p_is_visible_on_website: formData.get("isVisibleOnWebsite") === "on",
    p_is_featured: formData.get("isFeatured") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0),
    p_components: toJsonbComponents(components),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/combo-packages");
  revalidatePath(`/dashboard/combo-packages/${id}`);
  redirect("/dashboard/combo-packages");
}

export async function toggleComboPackageStatus(
  id: string,
  field: "is_active" | "is_visible_on_website" | "is_featured",
  currentValue: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("combo_packages")
    .select("is_active, is_visible_on_website, is_featured, display_order")
    .eq("id", id)
    .single();

  if (!pkg) return;

  await supabase.rpc("set_combo_package_status", {
    p_id: id,
    p_is_active: field === "is_active" ? !currentValue : pkg.is_active,
    p_is_visible_on_website: field === "is_visible_on_website" ? !currentValue : pkg.is_visible_on_website,
    p_is_featured: field === "is_featured" ? !currentValue : pkg.is_featured,
    p_display_order: pkg.display_order,
  });

  revalidatePath("/dashboard/combo-packages");
}
