"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Branch, Product } from "@/types";
import type { ProductFormState } from "@/app/dashboard/inventory/actions";

interface ProductFormProps {
  action: (
    prevState: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  initialValues?: Product;
  submitLabel: string;
  defaultReorderLevel?: number;
  /** Only needed (and only rendered) when adding a new product — see the
   * Quantity in stock / Branch fields below. */
  branches?: Branch[];
}

const initialState: ProductFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function ProductForm({
  action,
  initialValues,
  submitLabel,
  defaultReorderLevel,
  branches,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const skuId = useId();
  const nameId = useId();
  const categoryId = useId();
  const unitId = useId();
  const costId = useId();
  const sellingId = useId();
  const quantityId = useId();
  const reorderId = useId();
  const supplierId = useId();
  const branchId = useId();
  const activeId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={skuId} className={labelClasses}>
            SKU
          </label>
          <input
            id={skuId}
            name="sku"
            required
            defaultValue={initialValues?.sku}
            placeholder="SP-150W-MONO"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={nameId} className={labelClasses}>
            Product name
          </label>
          <input
            id={nameId}
            name="name"
            required
            defaultValue={initialValues?.name}
            placeholder="150W Monocrystalline Solar Panel"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={categoryId} className={labelClasses}>
            Category
          </label>
          <input
            id={categoryId}
            name="category"
            required
            defaultValue={initialValues?.category}
            placeholder="Solar Panels"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={unitId} className={labelClasses}>
            Unit of measure
          </label>
          <input
            id={unitId}
            name="unit"
            defaultValue={initialValues?.unit ?? "unit"}
            placeholder="unit"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={costId} className={labelClasses}>
            Cost price (₦)
          </label>
          <input
            id={costId}
            name="costPrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={initialValues?.costPrice}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={sellingId} className={labelClasses}>
            Selling price (₦)
          </label>
          <input
            id={sellingId}
            name="sellingPrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={initialValues?.sellingPrice}
            className={inputClasses}
          />
        </div>

        {!initialValues && (
          <div>
            <label htmlFor={quantityId} className={labelClasses}>
              Starting quantity in stock
            </label>
            <input
              id={quantityId}
              name="quantityInStock"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={0}
              className={inputClasses}
            />
          </div>
        )}

        <div>
          <label htmlFor={reorderId} className={labelClasses}>
            Reorder level
          </label>
          <input
            id={reorderId}
            name="reorderLevel"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={initialValues?.reorderLevel ?? defaultReorderLevel}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Flagged as low stock when a branch&apos;s quantity falls to or
            below this level.
          </p>
        </div>

        <div>
          <label htmlFor={supplierId} className={labelClasses}>
            Supplier <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={supplierId}
            name="supplier"
            defaultValue={initialValues?.supplier ?? ""}
            placeholder="e.g. Jinko Solar Nigeria"
            className={inputClasses}
          />
        </div>

        {!initialValues && (
          <div>
            <label htmlFor={branchId} className={labelClasses}>
              Branch
            </label>
            <select id={branchId} name="branchId" required className={inputClasses}>
              <option value="">Select a branch…</option>
              {branches?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Where the starting quantity above is received. Stock at other
              branches starts at zero — move it in via Stock Movement.
            </p>
          </div>
        )}
      </div>

      {initialValues && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Stock corrections happen from{" "}
          <Link href="/dashboard/stock-movement/new" className="text-brand-green dark:text-emerald-400 hover:underline">
            Stock Movement
          </Link>
          , which is branch-aware and keeps the audit trail complete.
        </p>
      )}

      <label htmlFor={activeId} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
        <input
          id={activeId}
          name="isActive"
          type="checkbox"
          defaultChecked={initialValues?.isActive ?? true}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-green dark:text-emerald-400 focus:ring-brand-green/30"
        />
        Active (visible for sale)
      </label>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/inventory"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
