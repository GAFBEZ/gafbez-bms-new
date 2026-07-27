"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import type { ComboComponentType, ComboPackage, Product } from "@/types";
import type { ComboPackageFormState } from "@/app/dashboard/combo-packages/actions";

interface ComboPackageFormProps {
  /** Already bound to the package id for an edit form -- see
   * src/app/dashboard/combo-packages/[id]/page.tsx, which passes
   * `updateComboPackage.bind(null, pkg.id)` rather than this component
   * doing the binding itself (keeps this component's action prop a
   * single, uniform useActionState-compatible signature). */
  action: (prevState: ComboPackageFormState, formData: FormData) => Promise<ComboPackageFormState>;
  products: Pick<Product, "id" | "name" | "sku">[];
  initialValues?: ComboPackage;
  submitLabel: string;
}

interface ComponentRow {
  productId: string;
  quantity: string;
  componentType: ComboComponentType;
  isRequired: boolean;
  displayName: string;
}

const COMPONENT_TYPES: ComboComponentType[] = ["inverter", "battery", "solar_panel", "accessory", "installation_service", "other"];

const initialState: ComboPackageFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function emptyRow(): ComponentRow {
  return { productId: "", quantity: "1", componentType: "accessory", isRequired: true, displayName: "" };
}

/** Owner/Admin only in practice (create_combo_package/update_combo_package
 * both raise for anyone else) -- the page rendering this form is
 * responsible for that gate, this component doesn't re-check role. */
export default function ComboPackageForm({ action, products, initialValues, submitLabel }: ComboPackageFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formId = useId();

  const [rows, setRows] = useState<ComponentRow[]>(
    initialValues && initialValues.components.length > 0
      ? initialValues.components.map((c) => ({
          productId: c.productId ?? "",
          quantity: String(c.quantity),
          componentType: c.componentType,
          isRequired: c.isRequired,
          displayName: c.displayName,
        }))
      : [emptyRow()],
  );

  const componentsJson = JSON.stringify(
    rows.map((row, index) => ({
      productId: row.productId || null,
      quantity: Number(row.quantity) || 0,
      componentType: row.componentType,
      isRequired: row.isRequired,
      displayName: row.displayName,
      displayOrder: index,
    })),
  );

  function updateRow(index: number, patch: Partial<ComponentRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="componentsJson" value={componentsJson} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-code`} className={labelClasses}>
            Package Code
          </label>
          <input id={`${formId}-code`} name="packageCode" required defaultValue={initialValues?.packageCode} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-name`} className={labelClasses}>
            Name
          </label>
          <input id={`${formId}-name`} name="name" required defaultValue={initialValues?.name} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-slug`} className={labelClasses}>
            Website Slug
          </label>
          <input id={`${formId}-slug`} name="websiteSlug" required defaultValue={initialValues?.websiteSlug} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-price`} className={labelClasses}>
            Final Price (NGN)
          </label>
          <input
            id={`${formId}-price`}
            name="finalPrice"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={initialValues?.finalPrice}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-capacity`} className={labelClasses}>
            System Capacity Text
          </label>
          <input
            id={`${formId}-capacity`}
            name="systemCapacityText"
            placeholder="e.g. 8 kVA / 10 kWh"
            defaultValue={initialValues?.systemCapacityText ?? ""}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-rank`} className={labelClasses}>
            Capacity Rank (higher = bigger system)
          </label>
          <input
            id={`${formId}-rank`}
            name="capacityRank"
            type="number"
            defaultValue={initialValues?.capacityRank ?? 0}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-appliances`} className={labelClasses}>
          Appliances Supported (comma-separated)
        </label>
        <input
          id={`${formId}-appliances`}
          name="appliancesSupported"
          placeholder="Fridge, TV, Fans, Lights"
          defaultValue={initialValues?.appliancesSupported.join(", ") ?? ""}
          className={inputClasses}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-short`} className={labelClasses}>
            Short Description
          </label>
          <textarea id={`${formId}-short`} name="shortDescription" rows={2} defaultValue={initialValues?.shortDescription ?? ""} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-full`} className={labelClasses}>
            Full Description
          </label>
          <textarea id={`${formId}-full`} name="fullDescription" rows={2} defaultValue={initialValues?.fullDescription ?? ""} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-scope`} className={labelClasses}>
            Installation Scope
          </label>
          <textarea id={`${formId}-scope`} name="installationScope" rows={2} defaultValue={initialValues?.installationScope ?? ""} className={inputClasses} />
        </div>
        <div>
          <label htmlFor={`${formId}-warranty`} className={labelClasses}>
            Warranty Text
          </label>
          <input id={`${formId}-warranty`} name="warrantyText" defaultValue={initialValues?.warrantyText ?? ""} className={inputClasses} />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-image`} className={labelClasses}>
          Main Image URL
        </label>
        <input
          id={`${formId}-image`}
          name="mainImageUrl"
          placeholder="Upload to the combo-package-images bucket first, then paste its public URL"
          defaultValue={initialValues?.mainImageUrl ?? ""}
          className={inputClasses}
        />
      </div>

      <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-200">Components (fixed -- shown to customers as inclusions, never with a price)</legend>
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-3 sm:grid-cols-6">
              <select
                value={row.componentType}
                onChange={(e) => updateRow(index, { componentType: e.target.value as ComboComponentType })}
                className={`${inputClasses} sm:col-span-1`}
              >
                {COMPONENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {row.componentType === "installation_service" ? (
                <input
                  value=""
                  disabled
                  placeholder="No product (service line)"
                  className={`${inputClasses} sm:col-span-2 opacity-60`}
                />
              ) : (
                <select
                  value={row.productId}
                  onChange={(e) => updateRow(index, { productId: e.target.value })}
                  className={`${inputClasses} sm:col-span-2`}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              )}
              <input
                value={row.displayName}
                onChange={(e) => updateRow(index, { displayName: e.target.value })}
                placeholder="Display name, e.g. 8kVA Inverter"
                className={`${inputClasses} sm:col-span-1`}
              />
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
                className={`${inputClasses} sm:col-span-1`}
              />
              <div className="flex items-center gap-2 sm:col-span-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={row.isRequired}
                    onChange={(e) => updateRow(index, { isRequired: e.target.checked })}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  disabled={rows.length === 1}
                  className="ml-auto text-red-600 disabled:opacity-30"
                  aria-label="Remove component"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, emptyRow()])}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
        >
          <Plus className="h-4 w-4" /> Add Component
        </button>
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="inspectionRequired" defaultChecked={initialValues?.inspectionRequired ?? true} /> Inspection Required
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="isActive" defaultChecked={initialValues?.isActive ?? true} /> Active
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="isVisibleOnWebsite" defaultChecked={initialValues?.isVisibleOnWebsite ?? false} /> Visible on Website
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="isFeatured" defaultChecked={initialValues?.isFeatured ?? false} /> Featured
        </label>
        <div>
          <label htmlFor={`${formId}-order`} className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
            Display Order
          </label>
          <input id={`${formId}-order`} name="displayOrder" type="number" defaultValue={initialValues?.displayOrder ?? 0} className={`${inputClasses} w-24`} />
        </div>
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link href="/dashboard/combo-packages" className="rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Cancel
        </Link>
      </div>
    </form>
  );
}
