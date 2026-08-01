"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/products";
import { slugify } from "@/lib/slug";
import type { ProductWebsiteDetails } from "@/types";

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

// ---------------------------------------------------------------------
// Website Details (Stage 2: Website Catalogue)
// ---------------------------------------------------------------------
// Every action below eventually calls update_product_website_details(),
// which is admin-only *in the database* (0028_website_catalogue.sql), not
// just behind the page-level `user.role !== "admin"` check the Edit
// Product page already does -- so a non-admin hitting these actions
// directly (bypassing the UI) still gets rejected by Postgres, the same
// way create_product()/update_product() already work.
//
// Each action re-fetches the product's current website details from the
// database before calling the RPC (which replaces the full field set, not
// a partial patch -- see the migration) and only overwrites the one or two
// fields it actually owns. That keeps the three concerns below --
// metadata, main image, gallery -- fully independent: uploading a gallery
// image can never clobber the short description someone typed a minute
// ago, and vice versa, regardless of which order the requests land in.

export interface WebsiteDetailsFormState {
  error: string | null;
  success?: boolean;
}

const emptyWebsiteDetails: ProductWebsiteDetails = {
  brand: null,
  model: null,
  shortDescription: null,
  fullDescription: null,
  websitePrice: null,
  websiteSlug: null,
  productImageUrl: null,
  galleryImageUrls: [],
  specifications: {},
  warrantyText: null,
  isVisibleOnWebsite: false,
  isFeaturedOnWebsite: false,
  websiteDisplayOrder: 0,
  isComboEligible: false,
  calculatorEligible: false,
};

async function currentWebsiteDetails(productId: string): Promise<ProductWebsiteDetails> {
  const product = await getProduct(productId);
  return product?.website ?? emptyWebsiteDetails;
}

async function callUpdateWebsiteDetails(productId: string, details: ProductWebsiteDetails) {
  const supabase = await createClient();
  return supabase.rpc("update_product_website_details", {
    p_id: productId,
    p_brand: details.brand,
    p_model: details.model,
    p_short_description: details.shortDescription,
    p_full_description: details.fullDescription,
    p_website_price: details.websitePrice,
    p_website_slug: details.websiteSlug,
    p_product_image_url: details.productImageUrl,
    p_gallery_image_urls: details.galleryImageUrls,
    p_specifications: details.specifications,
    p_warranty_text: details.warrantyText,
    p_is_visible_on_website: details.isVisibleOnWebsite,
    p_is_featured_on_website: details.isFeaturedOnWebsite,
    p_website_display_order: details.websiteDisplayOrder,
    p_is_combo_eligible: details.isComboEligible,
    p_calculator_eligible: details.calculatorEligible,
  });
}

function friendlyWebsiteDetailsError(message: string, code?: string): string {
  if (code === "23505") return "That website URL slug is already used by another product.";
  return message;
}

export async function updateProductWebsiteDetails(
  productId: string,
  _prevState: WebsiteDetailsFormState,
  formData: FormData,
): Promise<WebsiteDetailsFormState> {
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const shortDescription = String(formData.get("shortDescription") ?? "").trim() || null;
  const fullDescription = String(formData.get("fullDescription") ?? "").trim() || null;
  const websitePriceRaw = String(formData.get("websitePrice") ?? "").trim();
  const websitePrice = websitePriceRaw === "" ? null : Number(websitePriceRaw);
  // Slugified server-side rather than trusting the submitted string as-is
  // -- the form pre-fills a slugified default, but staff can still type
  // over it (or old data predating that default can already be
  // non-slug-shaped), and a raw value like "Cworth 15kW Lithium Battery"
  // breaks the product's own /shop/[slug] page.
  const websiteSlug = slugify(String(formData.get("websiteSlug") ?? "").trim()) || null;
  const warrantyText = String(formData.get("warrantyText") ?? "").trim() || null;
  const isVisibleOnWebsite = formData.get("isVisibleOnWebsite") === "on";
  const isFeaturedOnWebsite = formData.get("isFeaturedOnWebsite") === "on";
  const websiteDisplayOrder = Number(formData.get("websiteDisplayOrder") ?? 0);
  const isComboEligible = formData.get("isComboEligible") === "on";
  const calculatorEligible = formData.get("calculatorEligible") === "on";
  const specificationsRaw = String(formData.get("specifications") ?? "{}");

  if (websitePrice !== null && (!Number.isFinite(websitePrice) || websitePrice < 0)) {
    return { error: "Website price must be zero or greater." };
  }
  if (!Number.isFinite(websiteDisplayOrder) || websiteDisplayOrder < 0) {
    return { error: "Display order must be zero or greater." };
  }

  let specifications: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(specificationsRaw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    specifications = parsed as Record<string, string>;
  } catch {
    return { error: "Specifications are invalid. Try removing and re-adding the affected row." };
  }

  // Images are owned by the upload/remove actions below, not this form --
  // always carry forward whatever is currently in the database for them.
  const current = await currentWebsiteDetails(productId);

  const { error } = await callUpdateWebsiteDetails(productId, {
    brand,
    model,
    shortDescription,
    fullDescription,
    websitePrice,
    websiteSlug,
    productImageUrl: current.productImageUrl,
    galleryImageUrls: current.galleryImageUrls,
    specifications,
    warrantyText,
    isVisibleOnWebsite,
    isFeaturedOnWebsite,
    websiteDisplayOrder,
    isComboEligible,
    calculatorEligible,
  });

  if (error) {
    return { error: friendlyWebsiteDetailsError(error.message, error.code) };
  }

  revalidatePath(`/dashboard/inventory/${productId}/edit`);
  revalidatePath("/dashboard/inventory");
  return { error: null, success: true };
}

// The file bytes themselves are uploaded to Supabase Storage directly
// from the browser (see ProductImageUploader.tsx), NOT proxied through
// these Server Actions -- a Server Action's request body goes through
// Vercel's serverless function pipeline, which hard-caps request bodies
// at 4.5MB no matter what Next.js is configured to allow, well under
// this bucket's own 5MB per-file limit. These actions only ever receive
// a short URL string after the browser has already uploaded the file
// straight to Storage, so they stay tiny no matter the image size.

export async function saveProductMainImageUrl(
  productId: string,
  imageUrl: string,
): Promise<WebsiteDetailsFormState> {
  const current = await currentWebsiteDetails(productId);
  const { error } = await callUpdateWebsiteDetails(productId, {
    ...current,
    productImageUrl: imageUrl,
  });

  if (error) {
    return { error: friendlyWebsiteDetailsError(error.message, error.code) };
  }

  revalidatePath(`/dashboard/inventory/${productId}/edit`);
  return { error: null, success: true };
}

export async function removeProductMainImage(productId: string): Promise<void> {
  const supabase = await createClient();
  const current = await currentWebsiteDetails(productId);

  if (current.productImageUrl) {
    // Best-effort: the RPC below is what actually matters for the product
    // record. If the storage object is already gone (or the URL predates
    // this bucket) this just no-ops rather than blocking the field clear.
    const path = extractProductImagesPath(current.productImageUrl);
    if (path) await supabase.storage.from("product-images").remove([path]);
  }

  await callUpdateWebsiteDetails(productId, { ...current, productImageUrl: null });
  revalidatePath(`/dashboard/inventory/${productId}/edit`);
}

export async function addProductGalleryImageUrls(
  productId: string,
  imageUrls: string[],
): Promise<WebsiteDetailsFormState> {
  if (imageUrls.length === 0) return { error: "Choose at least one image file to upload." };

  const current = await currentWebsiteDetails(productId);
  const { error } = await callUpdateWebsiteDetails(productId, {
    ...current,
    galleryImageUrls: [...current.galleryImageUrls, ...imageUrls],
  });

  if (error) {
    return { error: friendlyWebsiteDetailsError(error.message, error.code) };
  }

  revalidatePath(`/dashboard/inventory/${productId}/edit`);
  return { error: null, success: true };
}

export async function removeProductGalleryImage(productId: string, imageUrl: string): Promise<void> {
  const supabase = await createClient();
  const current = await currentWebsiteDetails(productId);

  const path = extractProductImagesPath(imageUrl);
  if (path) await supabase.storage.from("product-images").remove([path]);

  await callUpdateWebsiteDetails(productId, {
    ...current,
    galleryImageUrls: current.galleryImageUrls.filter((url) => url !== imageUrl),
  });
  revalidatePath(`/dashboard/inventory/${productId}/edit`);
}

/** Recovers the storage object path (e.g. "<productId>/main.jpg") from a
 * public URL previously returned by getPublicUrl() for this bucket, so
 * remove() can be called with just the URL a form/button already has. */
function extractProductImagesPath(publicUrl: string): string | null {
  const marker = "/object/public/product-images/";
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export interface SpecialOrderQuantityFormState {
  error: string | null;
}

/** Sets how many units of a product the branch can sell right now without
 * physical stock backing it (0036_special_order_quantity.sql) -- entirely
 * separate from quantityInStock, never touches it, so Inventory Master's
 * totals stay accurate. Pass null to clear it back to "no special-order
 * availability". set_special_order_quantity itself enforces admin-only. */
export async function setSpecialOrderQuantity(
  productId: string,
  branchId: string,
  quantity: number | null,
): Promise<SpecialOrderQuantityFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_special_order_quantity", {
    p_product_id: productId,
    p_branch_id: branchId,
    p_quantity: quantity,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inventory");
  return { error: null };
}
