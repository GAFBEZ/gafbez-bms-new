"use client";

import { useState, useTransition } from "react";
import { deactivateWebsiteCustomer, deleteWebsiteCustomer } from "@/app/dashboard/customers/websiteCustomerActions";

interface WebsiteCustomerActionsProps {
  customerId: string;
  customerName: string;
  isActive: boolean;
}

/** Admin-only -- the caller (WebsiteCustomerTable / InstallerApplicationRow)
 * is responsible for only rendering this for an admin session; the
 * Server Actions themselves also re-check is_admin()/role, so this is
 * pure UI gating, not the real security boundary. */
export function WebsiteCustomerActions({ customerId, customerName, isActive }: WebsiteCustomerActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDeactivate() {
    if (!window.confirm(`Deactivate ${customerName}? They won't be able to log in or check out. This can be reversed directly in Supabase if needed.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deactivateWebsiteCustomer(customerId);
      setError(result.error);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete ${customerName}? This can't be undone.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteWebsiteCustomer(customerId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        {isActive && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleDeactivate}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Deactivate
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          className="rounded-lg border border-red-300 dark:border-red-900 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && <p className="max-w-[220px] text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
