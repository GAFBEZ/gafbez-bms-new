"use client";

import { useState } from "react";
import Link from "next/link";
import { Receipt, X } from "lucide-react";
import { clearPendingReceipt, peekPendingReceipt } from "@/lib/pendingReceipt";

/** Shown on the Daily Sales list page -- the page Record Sale redirects
 * to on success -- when there's a just-recorded sale waiting to become a
 * receipt/invoice (see SaleForm's handleSubmit, which stashes it right
 * before submitting). Only reads/peeks here (via a lazy initializer, so
 * it's a plain one-time read rather than an effect-driven state sync);
 * the Invoice Builder's "new" page is what actually consumes and clears
 * it once the installer/client follows through. */
export function PendingReceiptBanner() {
  const [pendingReceipt] = useState(() => peekPendingReceipt());
  const [dismissed, setDismissed] = useState(false);

  if (!pendingReceipt || dismissed) return null;

  const customerName = pendingReceipt.customerName || "this customer";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-green/30 bg-brand-green/5 dark:border-emerald-400/30 dark:bg-emerald-400/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Receipt className="h-4 w-4 shrink-0 text-brand-green dark:text-emerald-400" aria-hidden="true" />
        Sale recorded for <span className="font-semibold">{customerName}</span> — generate a receipt/invoice for
        them?
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/invoice-builder/new"
          className="rounded-lg bg-brand-green px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-green-dark"
        >
          Generate Receipt
        </Link>
        <button
          type="button"
          onClick={() => {
            clearPendingReceipt();
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
