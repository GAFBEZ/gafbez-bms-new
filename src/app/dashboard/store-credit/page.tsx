import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getStoreCreditAccounts, getStoreCreditLedger } from "@/lib/storeCredit";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import AdjustCreditForm from "@/components/storeCredit/AdjustCreditForm";

/** Owner/Admin only -- section 31: store credit liabilities are an
 * Owner-only financial detail, not shown to Managers. */
export default async function StoreCreditPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Store Credit" />
        <EmptyState title="Owner/Admin only" description="Store credit balances and liabilities are restricted to Owner/Admin accounts." />
      </div>
    );
  }

  const [accounts, ledger] = await Promise.all([getStoreCreditAccounts(), getStoreCreditLedger()]);
  const totalLiability = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Store Credit" description="Outstanding customer store credit balances -- a liability until spent or expired (it never expires)." />

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
  );
}
