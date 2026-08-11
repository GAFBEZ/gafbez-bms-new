"use client";

import { useId, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import RefundRequestRow from "@/components/refunds/RefundRequestRow";
import AdjustCreditForm from "@/components/storeCredit/AdjustCreditForm";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import type { RefundRequest, StoreCreditAccountSummary, StoreCreditLedgerEntry } from "@/types";

interface RefundsTabsProps {
  requests: RefundRequest[];
  isAdmin: boolean;
  user: CurrentUser | null;
  // Store Credit tab -- only meaningful (and only fetched by the page) when isAdmin.
  accounts: StoreCreditAccountSummary[];
  ledger: StoreCreditLedgerEntry[];
}

type Tab = "refunds" | "credit";

/**
 * "Refund Requests" (staff/manager review queue) and "Store Credit"
 * (admin-only balances/liability) folded into one sidebar item -- a
 * refund is often what creates store credit in the first place. Same
 * tablist/tabpanel pattern as CustomerTabs. The Store Credit tab button
 * itself is only rendered for an admin, rather than shown-but-locked.
 */
export function RefundsTabs({ requests, isAdmin, user, accounts, ledger }: RefundsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("refunds");
  const refundsTabId = useId();
  const creditTabId = useId();
  const totalLiability = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Refund and credit views" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          role="tab"
          id={refundsTabId}
          aria-selected={activeTab === "refunds"}
          aria-controls="refund-requests-panel"
          onClick={() => setActiveTab("refunds")}
          className={
            activeTab === "refunds"
              ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
              : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }
        >
          Refund Requests
        </button>
        {isAdmin && (
          <button
            type="button"
            role="tab"
            id={creditTabId}
            aria-selected={activeTab === "credit"}
            aria-controls="store-credit-panel"
            onClick={() => setActiveTab("credit")}
            className={
              activeTab === "credit"
                ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
                : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }
          >
            Store Credit
          </button>
        )}
      </div>

      <div id="refund-requests-panel" role="tabpanel" aria-labelledby={refundsTabId} hidden={activeTab !== "refunds"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Customer refund, store credit, and paid-order-cancellation requests awaiting review.</p>

        {requests.length === 0 ? (
          <EmptyState title="No refund requests" description="Customer refund and cancellation requests will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {requests.map((request) => (
                  <RefundRequestRow
                    key={request.id}
                    request={request}
                    isAdmin={isAdmin}
                    canManageBranch={isAdmin || (user?.isBranchManager === true && user?.branchId === request.branchId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <div id="store-credit-panel" role="tabpanel" aria-labelledby={creditTabId} hidden={activeTab !== "credit"} className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding customer store credit balances -- a liability until spent or expired (it never expires).</p>

          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Outstanding Liability</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalLiability)}</p>
          </div>

          <AdjustCreditForm />

          {accounts.length === 0 ? (
            <EmptyState title="No store credit issued yet" description="Balances will appear here once a refund is converted to store credit." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Customer ID</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {accounts.map((account) => (
                    <tr key={account.customerId}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{account.customerName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{account.customerId}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(account.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Ledger Activity</h2>
            {ledger.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{entry.customerName ?? entry.customerId}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{entry.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(entry.createdAt)}</p>
                    </div>
                    <span className={`font-semibold ${entry.balanceAfter > entry.balanceBefore ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {entry.balanceAfter > entry.balanceBefore ? "+" : "-"}
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
