"use client";

import { useActionState } from "react";
import { adjustStoreCredit, type AdjustCreditFormState } from "@/app/dashboard/store-credit/actions";

const initial: AdjustCreditFormState = { error: null };
const inputClasses =
  "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none";

/** Owner-only manual correction (goodwill credit, fixing a mistake) --
 * see admin_adjust_store_credit in the Stage 6 migration, which
 * re-checks is_admin() regardless of who reaches this form. Positive
 * amount credits, negative debits; every use leaves an auditable ledger
 * row, there is no other way to change a balance. */
export default function AdjustCreditForm() {
  const [state, formAction, isPending] = useActionState(adjustStoreCredit, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Manual Adjustment</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input name="customerId" placeholder="Customer ID (uuid)" required className={inputClasses} />
        <input name="amount" type="number" step="0.01" placeholder="Amount (negative to debit)" required className={inputClasses} />
        <input name="description" placeholder="Reason" required className={inputClasses} />
      </div>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={isPending} className="self-start rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {isPending ? "Saving…" : "Apply Adjustment"}
      </button>
    </form>
  );
}
