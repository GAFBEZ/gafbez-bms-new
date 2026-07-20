"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateTimeCell } from "@/components/ui/DateTimeCell";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Sale, SaleStatus } from "@/types";

interface SaleTableProps {
  sales: Sale[];
}

type StatusFilter = "all" | SaleStatus;

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

export function SaleTable({ sales }: SaleTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return sales;
    return sales.filter((sale) => sale.status === statusFilter);
  }, [sales, statusFilter]);

  if (sales.length === 0) {
    return (
      <EmptyState
        title="No sales recorded yet"
        description="Record your first sale to start building the daily sales log, or switch branches above if you're expecting to see some here."
      />
    );
  }

  function handleExport() {
    downloadCsv(
      `daily-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Customer", "Branch", "Items", "Total", "Paid", "Status", "Date", "Time", "Recorded by"],
      filtered.map((sale) => [
        sale.customerName ?? "Walk-in customer",
        sale.branchName,
        sale.itemCount,
        sale.totalAmount,
        sale.amountPaid,
        statusLabels[sale.status],
        formatDate(sale.createdAt),
        formatTime(sale.createdAt),
        sale.recordedBy ?? "",
      ]),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="w-fit cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching sales" description="Try a different status filter." />
      ) : (
        <>
          <ul className="flex flex-col gap-3 sm:hidden">
            {filtered.map((sale) => (
              <li
                key={sale.id}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {sale.customerName ?? "Walk-in customer"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {sale.branchName} · {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/daily-sales/${sale.id}`}
                    aria-label={`View sale for ${sale.customerName ?? "walk-in customer"}`}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(sale.totalAmount)}
                      <span
                        className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[sale.status]}`}
                      >
                        {statusLabels[sale.status]}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      Paid {formatCurrency(sale.amountPaid)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400 dark:text-gray-500">
                    <DateTimeCell value={sale.createdAt} />
                    {sale.recordedBy && <p className="mt-0.5">{sale.recordedBy}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Items
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Total
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Paid
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Recorded by
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((sale) => (
                <tr key={sale.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {sale.customerName ?? "Walk-in customer"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{sale.branchName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{sale.itemCount}</td>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(sale.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {formatCurrency(sale.amountPaid)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[sale.status]}`}
                    >
                      {statusLabels[sale.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    <DateTimeCell value={sale.createdAt} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {sale.recordedBy ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/daily-sales/${sale.id}`}
                      aria-label={`View sale for ${sale.customerName ?? "walk-in customer"}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
