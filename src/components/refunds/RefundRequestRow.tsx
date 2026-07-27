"use client";

import { useState, useTransition } from "react";
import type { RefundRequest } from "@/types";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { managerApproveRefund, ownerApproveRefund, rejectRefund, recordManualRefundCompletion } from "@/app/dashboard/refunds/actions";

interface RefundRequestRowProps {
  request: RefundRequest;
  isAdmin: boolean;
  canManageBranch: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  full_refund: "Full Refund",
  store_credit_conversion: "Store Credit",
  paid_order_cancellation: "Paid Order Cancellation",
  package_unsuitable: "Awaiting Customer Decision",
};

export default function RefundRequestRow({ request, isAdmin, canManageBranch }: RefundRequestRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [showManual, setShowManual] = useState(false);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  const canReview = (canManageBranch || isAdmin) && request.status === "pending" && request.requestType !== "package_unsuitable";
  const canOwnerApprove = isAdmin && (request.status === "pending" || request.status === "manager_approved") && request.requestType !== "package_unsuitable";
  const canManualComplete = isAdmin && request.status === "processing";

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{request.orderNumber}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{request.customerName}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{TYPE_LABELS[request.requestType] ?? request.requestType}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(request.requestedAmount)}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-brand-green-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-green dark:text-emerald-400">
          {request.status.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(request.requestedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {canReview && !rejecting && (
            <div className="flex flex-wrap gap-2">
              {!isAdmin && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => managerApproveRefund(request.id))}
                  className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Manager Approve
                </button>
              )}
              {canOwnerApprove && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => ownerApproveRefund(request.id, request.orderId))}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Owner Approve
                </button>
              )}
              <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">
                Reject
              </button>
            </div>
          )}

          {rejecting && (
            <div className="flex flex-col gap-1.5">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => rejectRefund(request.id, reason))}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Confirm Reject
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="text-xs text-gray-500 dark:text-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {canManualComplete && !showManual && (
            <button type="button" onClick={() => setShowManual(true)} className="text-xs font-semibold text-brand-green dark:text-emerald-400">
              Record Manual Completion
            </button>
          )}
          {canManualComplete && showManual && (
            <div className="flex flex-col gap-1.5">
              <input
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="Paystack refund reference"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => recordManualRefundCompletion(request.id, manualRef))}
                className="self-start rounded-lg bg-brand-green px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                Confirm Completed
              </button>
            </div>
          )}

          {request.status === "completed" && request.paystackRefundReference && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {request.paystackRefundReference}</p>
          )}
          {request.status === "rejected" && request.rejectionReason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{request.rejectionReason}</p>
          )}
        </div>
      </td>
    </tr>
  );
}
