"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Branch, Customer } from "@/types";
import type { CustomerFormState } from "@/app/dashboard/customers/actions";

interface CustomerFormProps {
  action: (
    prevState: CustomerFormState,
    formData: FormData,
  ) => Promise<CustomerFormState>;
  branches: Branch[];
  initialValues?: Customer;
  submitLabel: string;
}

const initialState: CustomerFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function CustomerForm({
  action,
  branches,
  initialValues,
  submitLabel,
}: CustomerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const addressId = useId();
  const branchFieldId = useId();
  const balanceId = useId();
  const notesId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className={labelClasses}>
            Customer name
          </label>
          <input
            id={nameId}
            name="name"
            required
            defaultValue={initialValues?.name}
            placeholder="Bala Solar Distributors"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={phoneId} className={labelClasses}>
            Phone <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={phoneId}
            name="phone"
            type="tel"
            defaultValue={initialValues?.phone ?? ""}
            placeholder="+234 801 234 5001"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={emailId} className={labelClasses}>
            Email <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            defaultValue={initialValues?.email ?? ""}
            placeholder="contact@customer.com"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <select
            id={branchFieldId}
            name="branchId"
            defaultValue={initialValues?.branchId ?? ""}
            className={inputClasses}
          >
            <option value="">No specific branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={addressId} className={labelClasses}>
            Address <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={addressId}
            name="address"
            defaultValue={initialValues?.address ?? ""}
            placeholder="Plot 12, Solar Way, Abuja"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={balanceId} className={labelClasses}>
            Outstanding balance (₦)
          </label>
          <input
            id={balanceId}
            name="outstandingBalance"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initialValues?.outstandingBalance ?? 0}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Tracked manually for now — this will become computed once invoicing exists.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={notesId} className={labelClasses}>
          Notes <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <textarea
          id={notesId}
          name="notes"
          rows={3}
          defaultValue={initialValues?.notes ?? ""}
          placeholder="Any other useful context about this customer…"
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
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/customers"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
