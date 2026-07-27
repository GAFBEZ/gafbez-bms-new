import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getInstallationJobs } from "@/lib/installationJobs";
import { formatDate } from "@/lib/format";
import type { InstallationStatus } from "@/types";

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

export default async function InstallationJobsPage() {
  const jobs = await getInstallationJobs();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Installation Jobs"
        description="Paid combo package orders -- site inspection through installation. Managers and permitted staff can act on their own branch's jobs."
      />

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
  );
}
