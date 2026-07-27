"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Product, ProductSpecification } from "@/types";
import {
  updateProductWebsiteDetails,
  type WebsiteDetailsFormState,
} from "@/app/dashboard/inventory/actions";
import {
  MainImageUploader,
  GalleryUploader,
} from "@/components/inventory/ProductImageUploader";
import {
  SpecificationEditor,
  recordToSpecificationRows,
  specificationRowsToRecord,
} from "@/components/inventory/SpecificationEditor";
import { ProductWebsitePreview } from "@/components/inventory/ProductWebsitePreview";
import {
  brandSuggestionsForCategory,
  specificationTemplateForCategory,
} from "@/lib/websiteCatalogueOptions";

interface ProductWebsiteDetailsFormProps {
  product: Product;
}

const initialState: WebsiteDetailsFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function ProductWebsiteDetailsForm({ product }: ProductWebsiteDetailsFormProps) {
  const { website } = product;
  const updateWithId = updateProductWebsiteDetails.bind(null, product.id);
  const [state, formAction, isPending] = useActionState(updateWithId, initialState);

  const [specRows, setSpecRows] = useState<ProductSpecification[]>(() => {
    const existing = recordToSpecificationRows(website.specifications);
    if (existing.length > 0) return existing;
    return specificationTemplateForCategory(product.category).map((key) => ({ key, value: "" }));
  });
  const specificationsJson = useMemo(() => JSON.stringify(specificationRowsToRecord(specRows)), [specRows]);
  const brandSuggestions = brandSuggestionsForCategory(product.category);

  const brandId = useId();
  const modelId = useId();
  const shortDescId = useId();
  const fullDescId = useId();
  const priceId = useId();
  const slugId = useId();
  const warrantyId = useId();
  const orderId = useId();
  const visibleId = useId();
  const featuredId = useId();
  const comboId = useId();
  const calcId = useId();
  const brandListId = useId();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-100 bg-brand-green-soft/60 p-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-brand-green-soft/10 dark:text-gray-400">
        These fields control what shows on the public website for this product. Cost price,
        selling price, reorder level, and supplier stay in Inventory Details and are never sent
        to the website.
      </div>

      <form action={formAction} className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={brandId} className={labelClasses}>
              Brand
            </label>
            <input
              id={brandId}
              name="brand"
              list={brandListId}
              defaultValue={website.brand ?? ""}
              placeholder="e.g. Deye"
              className={inputClasses}
            />
            <datalist id={brandListId}>
              {brandSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor={modelId} className={labelClasses}>
              Model
            </label>
            <input
              id={modelId}
              name="model"
              defaultValue={website.model ?? ""}
              placeholder="e.g. SUN-5K-SG04LP1-EU"
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor={priceId} className={labelClasses}>
              Website price (₦)
            </label>
            <input
              id={priceId}
              name="websitePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={website.websitePrice ?? ""}
              placeholder="Leave blank to hide the price"
              className={inputClasses}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Independent of cost price, BMS selling price, and any future branch price.
            </p>
          </div>

          <div>
            <label htmlFor={slugId} className={labelClasses}>
              Website URL slug
            </label>
            <input
              id={slugId}
              name="websiteSlug"
              defaultValue={website.websiteSlug ?? ""}
              placeholder="e.g. deye-5kva-hybrid-inverter"
              className={inputClasses}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Must be unique across all products. Leave blank if not ready yet.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={shortDescId} className={labelClasses}>
              Short description
            </label>
            <textarea
              id={shortDescId}
              name="shortDescription"
              defaultValue={website.shortDescription ?? ""}
              rows={2}
              placeholder="One or two sentences shown on product cards and search results."
              className={inputClasses}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={fullDescId} className={labelClasses}>
              Full description
            </label>
            <textarea
              id={fullDescId}
              name="fullDescription"
              defaultValue={website.fullDescription ?? ""}
              rows={5}
              placeholder="Full product page description."
              className={inputClasses}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={warrantyId} className={labelClasses}>
              Warranty
            </label>
            <input
              id={warrantyId}
              name="warrantyText"
              defaultValue={website.warrantyText ?? ""}
              placeholder="e.g. 5 years manufacturer warranty"
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor={orderId} className={labelClasses}>
              Display order
            </label>
            <input
              id={orderId}
              name="websiteDisplayOrder"
              type="number"
              min="0"
              step="1"
              defaultValue={website.websiteDisplayOrder}
              className={inputClasses}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Lower numbers show first. Products with the same order fall back to name.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <label htmlFor={visibleId} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input
              id={visibleId}
              name="isVisibleOnWebsite"
              type="checkbox"
              defaultChecked={website.isVisibleOnWebsite}
              className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green/30 dark:border-gray-600"
            />
            Visible on website
          </label>
          <label htmlFor={featuredId} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input
              id={featuredId}
              name="isFeaturedOnWebsite"
              type="checkbox"
              defaultChecked={website.isFeaturedOnWebsite}
              className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green/30 dark:border-gray-600"
            />
            Featured on website
          </label>
          <label htmlFor={comboId} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input
              id={comboId}
              name="isComboEligible"
              type="checkbox"
              defaultChecked={website.isComboEligible}
              className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green/30 dark:border-gray-600"
            />
            Eligible for combo packages
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
              (flag only — combo packages aren&apos;t built yet)
            </span>
          </label>
          <label htmlFor={calcId} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input
              id={calcId}
              name="calculatorEligible"
              type="checkbox"
              defaultChecked={website.calculatorEligible}
              className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green/30 dark:border-gray-600"
            />
            Eligible for load calculator
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
              (flag only — the advanced calculator isn&apos;t built yet)
            </span>
          </label>
        </div>

        <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Specifications
          </h3>
          <SpecificationEditor rows={specRows} onChange={setSpecRows} />
          <input type="hidden" name="specifications" value={specificationsJson} />
        </div>

        {state.error && (
          <p
            className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state.success && !state.error && (
          <p className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/40 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Website details saved.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save Website Details"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Main image
        </h3>
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          The primary photo shown on the product card and page header.
        </p>
        <MainImageUploader productId={product.id} imageUrl={website.productImageUrl} />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Gallery images
        </h3>
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          Additional photos shown on the product page.
        </p>
        <GalleryUploader productId={product.id} imageUrls={website.galleryImageUrls} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Website preview
        </h3>
        <ProductWebsitePreview product={product} />
      </div>
    </div>
  );
}
