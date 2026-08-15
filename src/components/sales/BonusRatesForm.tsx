"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateBonusRates, type BonusRatesFormState } from "@/app/dashboard/daily-sales/bonus-actions";
import type { BonusRates } from "@/types";

interface BonusRatesFormProps {
  rates: BonusRates;
}

const initialState: BonusRatesFormState = { error: null };

const CATEGORY_FIELDS: { key: keyof BonusRates; label: string }[] = [
  { key: "solar_panel", label: "Solar Panel" },
  { key: "inverter", label: "Inverter" },
  { key: "battery", label: "Battery" },
];

export function BonusRatesForm({ rates }: BonusRatesFormProps) {
  const [state, formAction, isPending] = useActionState(updateBonusRates, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bonus per item sold (₦)</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CATEGORY_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`bonus-rate-${key}`} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
            <input
              id={`bonus-rate-${key}`}
              name={key}
              type="number"
              min="0"
              step="0.01"
              defaultValue={rates[key]}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
        ))}
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="flex items-start gap-2 rounded-lg bg-brand-green-soft px-3 py-2 text-xs text-brand-green dark:text-emerald-400" role="status">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Rates saved.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="w-fit rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Rates"}
        </button>
      </div>
    </form>
  );
}
