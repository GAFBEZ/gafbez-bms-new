"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { createSale } from "@/app/dashboard/daily-sales/actions";
import { formatCurrency } from "@/lib/format";
import type { Branch, Customer, Product } from "@/types";

interface SaleFormProps {
  products: (Pick<Product, "id" | "name" | "sku" | "sellingPrice"> & {
    stockByBranch: Record<string, number>;
  })[];
  customers: Pick<Customer, "id" | "name">[];
  branches: Branch[];
  defaultBranchId?: string;
  /** Set for a non-admin with an assigned branch — the branch field becomes fixed instead of a dropdown. */
  lockedBranch: { id: string; name: string } | null;
}

interface LineItem {
  rowId: string;
  productId: string;
  /** Kept as raw text while editing so clearing the field to retype doesn't
   * snap back to a fallback value — only parsed to a number for math/submit. */
  quantity: string;
  unitPrice: string;
}

const initialState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function emptyRow(): LineItem {
  return { rowId: nextRowId(), productId: "", quantity: "1", unitPrice: "0" };
}

export function SaleForm({
  products,
  customers,
  branches,
  defaultBranchId,
  lockedBranch,
}: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(createSale, initialState);
  const [items, setItems] = useState<LineItem[]>([emptyRow()]);
  const [amountPaid, setAmountPaid] = useState("0");
  const [branch, setBranch] = useState(lockedBranch?.id ?? defaultBranchId ?? "");

  const customerId = useId();
  const branchFieldId = useId();
  const amountPaidId = useId();

  const productById = new Map(products.map((p) => [p.id, p]));
  const total = items.reduce(
    (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
    0,
  );
  const amountPaidNumber = toNumber(amountPaid);

  /** Stock at the currently-selected branch, or 0 if none is picked yet. */
  function stockFor(productId: string): number {
    return branch ? (productById.get(productId)?.stockByBranch[branch] ?? 0) : 0;
  }

  function updateRow(rowId: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function handleProductChange(rowId: string, productId: string) {
    const product = productById.get(productId);
    updateRow(rowId, {
      productId,
      unitPrice: String(product?.sellingPrice ?? 0),
    });
  }

  function addRow() {
    setItems((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((row) => row.rowId !== rowId) : prev));
  }

  const serializedItems = JSON.stringify(
    items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
      })),
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <input type="hidden" name="items" value={serializedItems} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={customerId} className={labelClasses}>
            Customer <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <select id={customerId} name="customerId" className={inputClasses}>
            <option value="">Walk-in customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch
          </label>
          {lockedBranch ? (
            <>
              <input type="hidden" name="branchId" value={lockedBranch.id} />
              <p
                id={branchFieldId}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {lockedBranch.name}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Your assigned branch — sales are recorded here only.
              </p>
            </>
          ) : (
            <>
              <select
                id={branchFieldId}
                name="branchId"
                required
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className={inputClasses}
              >
                <option value="">Select a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Stock shown per product below is for this branch.
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <p className={labelClasses}>Items</p>
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const product = productById.get(item.productId);
            const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
            return (
              <div
                key={item.rowId}
                className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
              >
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Product</label>
                  <select
                    value={item.productId}
                    onChange={(event) => handleProductChange(item.rowId, event.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — {branch ? `${stockFor(p.id)} in stock` : "pick a branch"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={product ? stockFor(product.id) : undefined}
                    value={item.quantity}
                    onChange={(event) =>
                      updateRow(item.rowId, { quantity: event.target.value })
                    }
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Unit Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateRow(item.rowId, { unitPrice: event.target.value })
                    }
                    className={inputClasses}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 sm:hidden">
                    {formatCurrency(subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(item.rowId)}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                    className="rounded-md p-2 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-green dark:text-emerald-400 hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another item
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <label htmlFor={amountPaidId} className={labelClasses}>
            Amount paid (₦)
          </label>
          <input
            id={amountPaidId}
            name="amountPaid"
            type="number"
            min="0"
            step="0.01"
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {amountPaidNumber >= total
              ? "Marked as fully paid."
              : amountPaidNumber > 0
                ? `Marked as partially paid — ${formatCurrency(total - amountPaidNumber)} added to customer's outstanding balance.`
                : "Marked as unpaid — full amount added to customer's outstanding balance."}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</p>
        </div>
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
          {isPending ? "Recording…" : "Record Sale"}
        </button>
        <Link
          href="/dashboard/daily-sales"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
