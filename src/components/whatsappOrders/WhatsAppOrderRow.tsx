"use client";

import { useState, useTransition } from "react";
import type { WhatsAppOrder } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { confirmWhatsAppOrder, rejectWhatsAppOrder } from "@/app/dashboard/whatsapp-orders/actions";

interface WhatsAppOrderRowProps {
  order: WhatsAppOrder;
}

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
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {!rejecting && (
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
        </div>
      </td>
    </tr>
  );
}
