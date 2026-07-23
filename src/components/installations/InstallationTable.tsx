"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { DeleteInstallationButton } from "@/components/installations/DeleteInstallationButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Installation } from "@/types";

interface InstallationTableProps {
  installations: Installation[];
  canDelete: boolean;
}

function itemsSummary(installation: Installation): string {
  const parts = [
    installation.inverterProductId ? `${installation.inverterQty}× ${installation.inverterProductName}` : null,
    installation.solarPanelProductId
      ? `${installation.solarPanelQty}× ${installation.solarPanelProductName}`
      : null,
    installation.batteryProductId ? `${installation.batteryQty}× ${installation.batteryProductName}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No inventory items attached";
}

export function InstallationTable({ installations, canDelete }: InstallationTableProps) {
  if (installations.length === 0) {
    return (
      <EmptyState
        title="No installations recorded yet"
        description="Add your first installation job to start tracking cost vs. profit, or switch branches above if you're expecting to see some here."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 sm:hidden">
        {installations.map((installation) => (
          <li
            key={installation.id}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {formatCurrency(installation.totalCharged)}
                </p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                  {installation.branchName} · {formatDate(`${installation.installationDate}T00:00:00`)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/dashboard/installations/${installation.id}/edit`}
                  aria-label="Edit installation record"
                  className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Link>
                {canDelete && <DeleteInstallationButton id={installation.id} />}
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{itemsSummary(installation)}</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">
                  Cost: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(installation.costTotal)}</span>
                </p>
              </div>
              <div className="text-right">
                <p
                  className={
                    installation.profit < 0
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "font-medium text-brand-green dark:text-emerald-400"
                  }
                >
                  {formatCurrency(installation.profit)} profit
                </p>
                {installation.recordedBy && (
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{installation.recordedBy}</p>
                )}
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
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Branch
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Items
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Charged
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Cost
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Profit
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
            {installations.map((installation) => (
              <tr key={installation.id} className="align-top">
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatDate(`${installation.installationDate}T00:00:00`)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{installation.branchName}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{itemsSummary(installation)}</td>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(installation.totalCharged)}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatCurrency(installation.costTotal)}
                </td>
                <td
                  className={
                    installation.profit < 0
                      ? "px-4 py-3 font-medium text-red-600 dark:text-red-400"
                      : "px-4 py-3 font-medium text-brand-green dark:text-emerald-400"
                  }
                >
                  {formatCurrency(installation.profit)}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {installation.recordedBy ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/installations/${installation.id}/edit`}
                      aria-label="Edit installation record"
                      className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    {canDelete && <DeleteInstallationButton id={installation.id} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
