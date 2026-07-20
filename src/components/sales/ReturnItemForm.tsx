"use client";

import { useActionState, useId } from "react";
import { AlertCircle, Undo2 } from "lucide-react";
import {
  recordReturn,
  type ReturnFormState,
} from "@/app/dashboard/daily-sales/actions";

interface ReturnItemFormProps {
  saleId: string;
  saleItemId: string;
  remaining: number;
}

const initialState: ReturnFormState = { error: null };

export function ReturnItemForm({ saleId, saleItemId, remaining }: ReturnItemFormProps) {
  const action = recordReturn.bind(null, saleId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const quantityId = useId();
  const reasonId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="saleItemId" value={saleItemId} />

      <div className="w-24">
        <label htmlFor={quantityId} className="sr-only">
          Return quantity
        </label>
        <input
          id={quantityId}
          name="quantity"
          type="number"
          min="1"
          max={remaining}
          step="1"
          required
          placeholder="Qty"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>

      <div className="flex-1 sm:min-w-[160px]">
        <label htmlFor={reasonId} className="sr-only">
          Reason (optional)
        </label>
        <input
          id={reasonId}
          name="reason"
          placeholder="Reason (optional)"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Processing…" : "Return"}
      </button>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400 sm:basis-full"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
