"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createStockMovement } from "@/app/dashboard/stock-movement/actions";
import type { Branch, Product } from "@/types";

interface StockMovementFormProps {
  products: Pick<Product, "id" | "name" | "sku">[];
  branches: Branch[];
  /** Set for a non-admin with an assigned branch — the branch field becomes fixed instead of a dropdown. */
  lockedBranch: { id: string; name: string } | null;
}

const initialState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function StockMovementForm({ products, branches, lockedBranch }: StockMovementFormProps) {
  const [state, formAction, isPending] = useActionState(
    createStockMovement,
    initialState,
  );

  const productId = useId();
  const branchId = useId();
  const typeId = useId();
  const quantityId = useId();
  const reasonId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={productId} className={labelClasses}>
            Product
          </label>
          <select id={productId} name="productId" required className={inputClasses}>
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={branchId} className={labelClasses}>
            Branch
          </label>
          {lockedBranch ? (
            <>
              <input type="hidden" name="branchId" value={lockedBranch.id} />
              <p
                id={branchId}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {lockedBranch.name}
              </p>
            </>
          ) : (
            <select id={branchId} name="branchId" required className={inputClasses}>
              <option value="">Select a branch…</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor={typeId} className={labelClasses}>
            Movement type
          </label>
          <select
            id={typeId}
            name="type"
            required
            defaultValue="in"
            className={inputClasses}
          >
            <option value="in">Stock In (received)</option>
            <option value="out">Stock Out (issued)</option>
          </select>
        </div>

        <div>
          <label htmlFor={quantityId} className={labelClasses}>
            Quantity
          </label>
          <input
            id={quantityId}
            name="quantity"
            type="number"
            min="1"
            step="1"
            required
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label htmlFor={reasonId} className={labelClasses}>
          Reason / note <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={3}
          placeholder="e.g. Supplier delivery, damaged in transit, used on installation job…"
          className={inputClasses}
        />
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Recording…" : "Record Movement"}
        </button>
        <Link
          href="/dashboard/stock-movement"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
