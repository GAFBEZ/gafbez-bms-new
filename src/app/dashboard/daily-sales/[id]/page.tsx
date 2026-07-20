import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReturnItemForm } from "@/components/sales/ReturnItemForm";
import { getSale } from "@/lib/sales";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import type { SaleStatus } from "@/types";

const statusStyles: Record<SaleStatus, string> = {
  paid: "bg-brand-green-soft text-brand-green dark:text-emerald-400",
  partial: "bg-brand-gold-soft text-brand-gold dark:text-amber-400",
  unpaid: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const statusLabels: Record<SaleStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getSale(id);

  if (!sale) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sale.customerName ?? "Walk-in customer"}
        description={`${sale.branchName} · ${formatDate(sale.createdAt)} at ${formatTime(sale.createdAt)}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {formatCurrency(sale.totalAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Paid
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {formatCurrency(sale.amountPaid)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Status
          </p>
          <p className="mt-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${statusStyles[sale.status]}`}
            >
              {statusLabels[sale.status]}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Line Items</h2>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {sale.items.map((item) => {
            const remaining = item.quantity - item.quantityReturned;
            return (
              <li key={item.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.productSku}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                      {item.quantityReturned > 0 && (
                        <span className="ml-2 text-red-600 dark:text-red-400">
                          ({item.quantityReturned} returned)
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </p>
                </div>

                {remaining > 0 ? (
                  <ReturnItemForm saleId={sale.id} saleItemId={item.id} remaining={remaining} />
                ) : (
                  <span className="w-fit rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Fully returned
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
