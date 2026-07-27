"use client";

import { useId, useState } from "react";
import type { Product } from "@/types";
import type { ProductFormState } from "@/app/dashboard/inventory/actions";
import { ProductForm } from "@/components/inventory/ProductForm";
import { ProductWebsiteDetailsForm } from "@/components/inventory/ProductWebsiteDetailsForm";

interface ProductEditTabsProps {
  product: Product;
  updateAction: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
}

type Tab = "inventory" | "website";

/**
 * Splits the Edit Product screen into two clearly separated areas, per the
 * Website Catalogue spec: Inventory Details (the original ProductForm,
 * untouched) and Website Details (Stage 2's new form/images/specs/preview).
 * Deliberately two independent <form>s under one tab switcher rather than
 * one merged form -- see actions.ts's comment on why metadata, main image,
 * and gallery are independent write paths; keeping Inventory Details as its
 * own untouched form/action is the same idea applied one level up, so nothing
 * about creating/editing a product's core inventory record changes here.
 */
export function ProductEditTabs({ product, updateAction }: ProductEditTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("inventory");
  const inventoryTabId = useId();
  const websiteTabId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Product edit sections" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          role="tab"
          id={inventoryTabId}
          aria-selected={activeTab === "inventory"}
          aria-controls="inventory-details-panel"
          onClick={() => setActiveTab("inventory")}
          className={
            activeTab === "inventory"
              ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
              : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }
        >
          Inventory Details
        </button>
        <button
          type="button"
          role="tab"
          id={websiteTabId}
          aria-selected={activeTab === "website"}
          aria-controls="website-details-panel"
          onClick={() => setActiveTab("website")}
          className={
            activeTab === "website"
              ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
              : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }
        >
          Website Details
        </button>
      </div>

      <div
        id="inventory-details-panel"
        role="tabpanel"
        aria-labelledby={inventoryTabId}
        hidden={activeTab !== "inventory"}
      >
        <ProductForm action={updateAction} initialValues={product} submitLabel="Save Changes" />
      </div>

      <div
        id="website-details-panel"
        role="tabpanel"
        aria-labelledby={websiteTabId}
        hidden={activeTab !== "website"}
      >
        <ProductWebsiteDetailsForm product={product} />
      </div>
    </div>
  );
}
