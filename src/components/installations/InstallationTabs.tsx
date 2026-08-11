"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Plus, ReceiptText, Wallet, TrendingUp, Percent } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { InstallationTable } from "@/components/installations/InstallationTable";
import { formatCurrency, formatDate } from "@/lib/format";
import { DASHBOARD_PALETTE } from "@/lib/palette";
import type { Installation, InstallationJob, InstallationStatus, InstallationSummary } from "@/types";

const STATUS_LABELS: Record<InstallationStatus, string> = {
  site_inspection_required: "Inspection Required",
  inspection_scheduled: "Inspection Scheduled",
  inspection_completed: "Inspection Completed",
  package_suitable: "Package Confirmed",
  package_unsuitable: "Package Unsuitable",
  awaiting_customer_decision: "Awaiting Customer",
  installation_scheduled: "Installation Scheduled",
  installation_in_progress: "Installation In Progress",
  installation_completed: "Installation Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

interface InstallationTabsProps {
  jobs: InstallationJob[];
  isAdmin: boolean;
  // Financial tab -- only meaningful (and only fetched by the page) when isAdmin.
  installations: Installation[];
  summary: InstallationSummary | null;
  activeBranchId: string;
  activeBranchName: string | undefined;
}

type Tab = "jobs" | "financial";

/**
 * "Installation Jobs" (staff-visible scheduling workflow) and
 * "Installation" (admin-only cost/profit per job) folded into one
 * sidebar item -- same job lifecycle, two lenses. Same tablist/tabpanel
 * pattern as CustomerTabs. The financial tab button itself is only
 * rendered for an admin, rather than shown-but-locked, so a non-admin
 * staff member never sees it at all.
 */
export function InstallationTabs({ jobs, isAdmin, installations, summary, activeBranchId, activeBranchName }: InstallationTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("jobs");
  const jobsTabId = useId();
  const financialTabId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Installation views" className="flex gap-2">
          <TabButton id={jobsTabId} isActive={activeTab === "jobs"} ariaControls="installation-jobs-panel" onClick={() => setActiveTab("jobs")}>
            Installation Jobs
          </TabButton>
          {isAdmin && (
            <TabButton id={financialTabId} isActive={activeTab === "financial"} ariaControls="installation-financial-panel" onClick={() => setActiveTab("financial")}>
              Installation Cost &amp; Profit
            </TabButton>
          )}
        </div>

        {activeTab === "financial" && isAdmin && (
          <Link
            href="/dashboard/installations/new"
            className="mb-2 flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Installation
          </Link>
        )}
      </div>

      <div id="installation-jobs-panel" role="tabpanel" aria-labelledby={jobsTabId} hidden={activeTab !== "jobs"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Paid combo package orders -- site inspection through installation. Managers and permitted staff can act on their own branch&apos;s jobs.
        </p>

        {jobs.length === 0 ? (
          <EmptyState title="No installation jobs yet" description="Paid combo package orders will appear here automatically." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{job.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.customerName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.packageName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.branchName ?? job.branchId}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-green-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-green dark:text-emerald-400">
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(job.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/installation-jobs/${job.id}`} className="font-semibold text-brand-green dark:text-emerald-400">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <div id="installation-financial-panel" role="tabpanel" aria-labelledby={financialTabId} hidden={activeTab !== "financial"} className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeBranchId === "all" || !activeBranchName
              ? "Track what customers were charged for installations vs. what the parts and labor cost."
              : `Showing installations for ${activeBranchName}. Switch branches from the selector above to see others.`}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <DashboardCard
              label="Total Amount Charged"
              value={formatCurrency(summary?.totalCharged ?? 0)}
              helperText={`${summary?.count ?? 0} installation${(summary?.count ?? 0) === 1 ? "" : "s"}`}
              icon={ReceiptText}
              accent={DASHBOARD_PALETTE.red}
            />
            <DashboardCard
              label="Total Amount Used"
              value={formatCurrency(summary?.totalCost ?? 0)}
              helperText="Parts, cable, accessories, labor"
              icon={Wallet}
              accent={DASHBOARD_PALETTE.magentaDark}
            />
            <DashboardCard
              label="Total Profit"
              value={formatCurrency(summary?.totalProfit ?? 0)}
              helperText="Charged minus cost"
              icon={TrendingUp}
              accent={DASHBOARD_PALETTE.amberDark}
            />
            <DashboardCard
              label="Profit Margin"
              value={`${(summary?.profitMarginPct ?? 0).toFixed(1)}%`}
              helperText="Profit as % of amount charged"
              icon={Percent}
              accent={DASHBOARD_PALETTE.violet}
            />
          </div>

          <InstallationTable installations={installations} canDelete />
        </div>
      )}
    </div>
  );
}
