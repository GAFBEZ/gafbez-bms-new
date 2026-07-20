"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  updateAppSettings,
  type SettingsFormState,
} from "@/app/dashboard/settings/actions";

interface InventoryDefaultsFormProps {
  defaultReorderLevel: number;
}

const initialState: SettingsFormState = { error: null };

export function InventoryDefaultsForm({ defaultReorderLevel }: InventoryDefaultsFormProps) {
  const [state, formAction, isPending] = useActionState(updateAppSettings, initialState);
  const reorderId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div>
        <label
          htmlFor={reorderId}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Default reorder level
        </label>
        <input
          id={reorderId}
          name="defaultReorderLevel"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={defaultReorderLevel}
          className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Pre-fills (but doesn&apos;t enforce) the reorder level when adding a
          new product in Inventory Master.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
      </button>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {state.success && !state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Saved.
        </p>
      )}
    </form>
  );
}
