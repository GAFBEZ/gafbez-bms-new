"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Branch } from "@/types";
import type { BranchFormState } from "@/app/dashboard/settings/branches/actions";

interface BranchFormProps {
  action: (
    prevState: BranchFormState,
    formData: FormData,
  ) => Promise<BranchFormState>;
  initialValues?: Branch;
  submitLabel: string;
}

const initialState: BranchFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function BranchForm({ action, initialValues, submitLabel }: BranchFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const nameId = useId();
  const statusId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      {initialValues && (
        <div>
          <p className={labelClasses}>Branch ID</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{initialValues.id}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Set once when the branch is created and used elsewhere (stock movements,
            sales, customers) — not editable.
          </p>
        </div>
      )}

      <div>
        <label htmlFor={nameId} className={labelClasses}>
          Branch name
        </label>
        <input
          id={nameId}
          name="name"
          required
          defaultValue={initialValues?.name}
          placeholder="GAFBEZ Energies Kano Branch"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor={statusId} className={labelClasses}>
          Status
        </label>
        <select
          id={statusId}
          name="status"
          defaultValue={initialValues?.status === "coming-soon" ? "coming_soon" : "active"}
          className={inputClasses}
        >
          <option value="active">Active</option>
          <option value="coming_soon">Coming Soon</option>
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          &ldquo;Coming Soon&rdquo; branches appear in the branch selector
          but can&apos;t be picked yet.
        </p>
      </div>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
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
          href="/dashboard/settings"
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
