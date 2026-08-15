import { describe, expect, it } from "vitest";
import { mapRow, type ProductRow } from "./products";

function makeRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "product-1",
    sku: "SKU-1",
    name: "5kVA Inverter",
    category: "Inverters",
    unit: "unit",
    cost_price: 300000,
    selling_price: 500000,
    quantity_in_stock: 12,
    reorder_level: 3,
    supplier: "Cworth",
    bonus_category: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    brand: "Cworth",
    model: "5K",
    short_description: null,
    full_description: null,
    website_price: null,
    website_slug: null,
    product_image_url: null,
    gallery_image_urls: null,
    specifications: null,
    warranty_text: null,
    is_visible_on_website: false,
    is_featured_on_website: false,
    website_display_order: 0,
    is_combo_eligible: false,
    calculator_eligible: false,
    ...overrides,
  };
}

// This is the exact merge/mapping logic behind the "stack depth limit
// exceeded" sales catalogue crash fixed earlier -- getProducts() now
// queries products and product_stock separately and merges them in JS
// via a Map, keyed by branch. mapRow is where that merged shape actually
// becomes the branch-scoped quantity a staff member sees.
describe("mapRow", () => {
  it("uses the company-wide quantity_in_stock and reports no special-order quantity for branchId 'all'", () => {
    const row = makeRow({
      quantity_in_stock: 42,
      product_stock: [{ quantity: 5, special_order_quantity: 2 }],
    });
    const product = mapRow(row, "all");

    expect(product.quantityInStock).toBe(42);
    expect(product.specialOrderQuantity).toBeNull();
  });

  it("uses the branch-specific quantity from product_stock for a real branch id", () => {
    const row = makeRow({
      quantity_in_stock: 42,
      product_stock: [{ quantity: 5, special_order_quantity: 2 }],
    });
    const product = mapRow(row, "abuja");

    expect(product.quantityInStock).toBe(5);
    expect(product.specialOrderQuantity).toBe(2);
  });

  it("defaults to 0 quantity and null special-order quantity when the branch has no stock row at all", () => {
    const row = makeRow({ quantity_in_stock: 42, product_stock: [] });
    const product = mapRow(row, "abuja");

    expect(product.quantityInStock).toBe(0);
    expect(product.specialOrderQuantity).toBeNull();
  });

  it("defaults the same way when product_stock is entirely absent from the row", () => {
    const row = makeRow({ product_stock: undefined });
    const product = mapRow(row, "abuja");

    expect(product.quantityInStock).toBe(0);
    expect(product.specialOrderQuantity).toBeNull();
  });

  it("coerces cost/selling price to numbers (defends against Postgres numeric-as-string)", () => {
    const row = makeRow({ cost_price: "300000" as unknown as number, selling_price: "500000" as unknown as number });
    const product = mapRow(row, "all");

    expect(product.costPrice).toBe(300000);
    expect(product.sellingPrice).toBe(500000);
  });

  it("keeps a null website price as null rather than coercing it to 0", () => {
    const row = makeRow({ website_price: null });
    const product = mapRow(row, "all");

    expect(product.website.websitePrice).toBeNull();
  });

  it("coerces a real website price to a number", () => {
    const row = makeRow({ website_price: 550000 });
    const product = mapRow(row, "all");

    expect(product.website.websitePrice).toBe(550000);
  });

  it("defaults null gallery images and specifications to empty collections", () => {
    const row = makeRow({ gallery_image_urls: null, specifications: null });
    const product = mapRow(row, "all");

    expect(product.website.galleryImageUrls).toEqual([]);
    expect(product.website.specifications).toEqual({});
  });
});
