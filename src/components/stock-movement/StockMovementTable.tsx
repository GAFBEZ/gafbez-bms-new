"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateTimeCell } from "@/components/ui/DateTimeCell";
import type { StockMovement } from "@/types";

interface StockMovementTableProps {
  movements: StockMovement[];
}

type TypeFilter = "all" | "in" | "out";

export function StockMovementTable({ movements }: StockMovementTableProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    if (typeFilter === "all") return movements;
    return movements.filter((movement) => movement.type === typeFilter);
  }, [movements, typeFilter]);

  if (movements.length === 0) {
    return (
      <EmptyState
        title="No stock movements yet"
        description="Record your first stock movement to start building the ledger, or switch branches above if you're expecting to see some here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="type-filter" className="sr-only">
          Filter by type
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          className="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="all">All types</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching movements"
          description="Try a different type filter."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 sm:hidden">
            {filtered.map((movement) => (
              <li
                key={movement.id}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {movement.productName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {movement.productSku} · {movement.branchName}
                    </p>
                  </div>
                  <span
                    className={
                      movement.type === "in"
                        ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green dark:text-emerald-400"
                        : "inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400"
                    }
                  >
                    {movement.type === "in" ? (
                      <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    )}
                    {movement.type === "in" ? "In" : "Out"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {movement.type === "in" ? "+" : "-"}
                      {movement.quantity}
                    </p>
                    {movement.reason && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{movement.reason}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400 dark:text-gray-500">
                    <DateTimeCell value={movement.createdAt} />
                    {movement.recordedBy && <p className="mt-0.5">{movement.recordedBy}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Reason
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Recorded by
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((movement) => (
                <tr key={movement.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{movement.productName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{movement.productSku}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{movement.branchName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        movement.type === "in"
                          ? "inline-flex items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green dark:text-emerald-400"
                          : "inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400"
                      }
                    >
                      {movement.type === "in" ? (
                        <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      )}
                      {movement.type === "in" ? "In" : "Out"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {movement.type === "in" ? "+" : "-"}
                    {movement.quantity}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{movement.reason || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    <DateTimeCell value={movement.createdAt} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {movement.recordedBy ?? "—"}
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
