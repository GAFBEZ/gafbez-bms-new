"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Branch, Expense } from "@/types";
import type { ExpenseFormState } from "@/app/dashboard/expenses/actions";

interface ExpenseFormProps {
  action: (
    prevState: ExpenseFormState,
    formData: FormData,
  ) => Promise<ExpenseFormState>;
  branches: Branch[];
  initialValues?: Expense;
  submitLabel: string;
}

const initialState: ExpenseFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  action,
  branches,
  initialValues,
  submitLabel,
}: ExpenseFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const branchFieldId = useId();
  const categoryId = useId();
  const descriptionId = useId();
  const amountId = useId();
  const dateId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch
          </label>
          <select
            id={branchFieldId}
            name="branchId"
            required
            defaultValue={initialValues?.branchId ?? ""}
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
          <label htmlFor={categoryId} className={labelClasses}>
            Category
          </label>
          <input
            id={categoryId}
            name="category"
            required
            defaultValue={initialValues?.category}
            placeholder="Rent, Transport, Utilities…"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={amountId} className={labelClasses}>
            Amount (₦)
          </label>
          <input
            id={amountId}
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={initialValues?.amount}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={dateId} className={labelClasses}>
            Date
          </label>
          <input
            id={dateId}
            name="expenseDate"
            type="date"
            required
            defaultValue={initialValues?.expenseDate ?? todayISODate()}
            className={inputClasses}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={descriptionId} className={labelClasses}>
            Description <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={descriptionId}
            name="description"
            defaultValue={initialValues?.description ?? ""}
            placeholder="What was this expense for?"
            className={inputClasses}
          />
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
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/expenses"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
