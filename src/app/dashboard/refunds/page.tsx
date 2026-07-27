import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRefundRequests } from "@/lib/refunds";
import { getCurrentUser } from "@/lib/auth";
import RefundRequestRow from "@/components/refunds/RefundRequestRow";

/** Section 20: Manager may approve operationally; Owner always sees
 * everything and gives final approval. A customer never approves their
 * own refund -- there is no customer-facing action anywhere on this
 * page, it's staff-only by route (not gated adminOnly at the nav level,
 * since Managers need to review too -- RLS already scopes rows to the
 * caller's own branch for non-admins). */
export default async function RefundsPage() {
  const [requests, user] = await Promise.all([getRefundRequests(), getCurrentUser()]);
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Refund Requests" description="Customer refund, store credit, and paid-order-cancellation requests awaiting review." />

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
  );
}
