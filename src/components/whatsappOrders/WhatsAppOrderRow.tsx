"use client";

import { useState, useTransition } from "react";
import type { WhatsAppOrder } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { confirmWhatsAppOrder, rejectWhatsAppOrder, markWhatsAppOrderPaid } from "@/app/dashboard/whatsapp-orders/actions";

interface WhatsAppOrderRowProps {
  order: WhatsAppOrder;
}

const STATUS_STYLES: Record<WhatsAppOrder["status"], string> = {
  whatsapp_review_required: "bg-brand-gold-soft text-amber-700 dark:text-amber-400",
  whatsapp_confirmed: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  cancelled: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  expired: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const STATUS_LABELS: Record<WhatsAppOrder["status"], string> = {
  whatsapp_review_required: "awaiting review",
  whatsapp_confirmed: "confirmed",
  completed: "paid & completed",
  cancelled: "rejected",
  expired: "expired",
};

export default function WhatsAppOrderRow({ order }: WhatsAppOrderRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  const isPendingReview = order.status === "whatsapp_review_required";
  const isConfirmedUnpaid = order.status === "whatsapp_confirmed" && order.paymentStatus !== "successful";

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{order.orderNumber}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
        <div className="flex flex-col">
          <span>{order.customerName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{order.customerPhone ?? order.customerEmail}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{order.branchName}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
        <ul className="flex flex-col gap-0.5">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`}>
              {item.quantity} x {item.productName}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(order.subtotal)}</td>
      <td className="px-4 py-3">
        <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {isPendingReview && !rejecting && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => confirmWhatsAppOrder(order.id))}
                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Confirm
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">
                Reject
              </button>
            </div>
          )}

          {isConfirmedUnpaid && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => markWhatsAppOrderPaid(order.id))}
              className="w-fit rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Mark as Paid
            </button>
          )}

          {rejecting && (
            <div className="flex flex-col gap-1.5">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => rejectWhatsAppOrder(order.id, reason))}
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

          {order.status === "cancelled" && order.cancellationReason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{order.cancellationReason}</p>
          )}
        </div>
      </td>
    </tr>
  );
}
