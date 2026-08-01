"use client";

import { useState, useTransition } from "react";
import { setSpecialOrderQuantity } from "@/app/dashboard/inventory/actions";

interface SpecialOrderQuantityEditorProps {
  productId: string;
  branchId: string;
  productName: string;
  initialValue: number | null;
}

/** "How many I can get quickly without it being on the shelf" -- entirely
 * separate from Stock Movement's audited in/out quantity, so it's a plain
 * direct-set field here rather than a movement form. Blank means "off" (no
 * special-order availability, the current/default state); a number
 * overrides get_available_to_sell() for this product/branch on the
 * website without ever touching quantityInStock. */
export function SpecialOrderQuantityEditor({ productId, branchId, productName, initialValue }: SpecialOrderQuantityEditorProps) {
  const [value, setValue] = useState(initialValue !== null ? String(initialValue) : "");
  const [saved, setSaved] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedValue = value.trim() === "" ? null : Number(value.trim());
  const isDirty = parsedValue !== saved;

  function handleSave() {
    if (parsedValue !== null && (!Number.isInteger(parsedValue) || parsedValue < 0)) {
      setError("Whole number, zero or greater.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setSpecialOrderQuantity(productId, branchId, parsedValue);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(parsedValue);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`special-order-${productId}`}>
          Special-order quantity for {productName}
        </label>
        <input
          id={`special-order-${productId}`}
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Off"
          className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green/30"
        />
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-brand-green px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "…" : "Save"}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
