"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";
import { adjustStock } from "@/app/dashboard/stock-movement/actions";
import type { Branch, Product } from "@/types";

interface StockAdjustmentFormProps {
  products: (Pick<Product, "id" | "name" | "sku"> & {
    stockByBranch: Record<string, number>;
  })[];
  branches: Branch[];
}

const initialState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function StockAdjustmentForm({ products, branches }: StockAdjustmentFormProps) {
  const [state, formAction, isPending] = useActionState(adjustStock, initialState);
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");

  const productFieldId = useId();
  const branchFieldId = useId();
  const countedQuantityId = useId();
  const reasonId = useId();

  const productById = new Map(products.map((p) => [p.id, p]));
  const currentQuantity = branchId ? (productById.get(productId)?.stockByBranch[branchId] ?? 0) : null;
  const counted = Number(countedQuantity);
  const hasValidCount = countedQuantity.trim() !== "" && Number.isInteger(counted) && counted >= 0;
  const delta = currentQuantity !== null && hasValidCount ? counted - currentQuantity : null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={productFieldId} className={labelClasses}>
            Product
          </label>
          <select
            id={productFieldId}
            name="productId"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className={inputClasses}
          >
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch
          </label>
          <select
            id={branchFieldId}
            name="branchId"
            required
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className={inputClasses}
          >
            <option value="">Select a branch…</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClasses}>Current recorded stock</span>
          <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            {productId && branchId ? currentQuantity : "Pick a product and branch"}
          </p>
        </div>

        <div>
          <label htmlFor={countedQuantityId} className={labelClasses}>
            Actual counted quantity
          </label>
          <input
            id={countedQuantityId}
            name="countedQuantity"
            type="number"
            min="0"
            step="1"
            required
            value={countedQuantity}
            onChange={(event) => setCountedQuantity(event.target.value)}
            className={inputClasses}
          />
        </div>
      </div>

      {delta !== null && (
        <p
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            delta === 0
              ? "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              : "bg-brand-green/10 text-brand-green-dark dark:text-brand-green"
          }`}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {delta === 0
            ? "Already matches the counted quantity -- no adjustment will be recorded."
            : delta > 0
              ? `This will record a Stock In of ${delta} (${currentQuantity} → ${counted}).`
              : `This will record a Stock Out of ${Math.abs(delta)} (${currentQuantity} → ${counted}).`}
        </p>
      )}

      <div>
        <label htmlFor={reasonId} className={labelClasses}>
          Reason / note <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={3}
          placeholder="e.g. Physical stock count, damaged/missing items found…"
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

      {state.info && (
        <p className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.info}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || delta === 0}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Correction"}
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
