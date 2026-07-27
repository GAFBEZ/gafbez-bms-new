import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getInstallationJob } from "@/lib/installationJobs";
import { getComboPackages, getComboPackage } from "@/lib/comboPackages";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import InstallationJobActions from "@/components/installationJobs/InstallationJobActions";

interface InstallationJobPageProps {
  params: Promise<{ id: string }>;
}

export default async function InstallationJobDetailPage({ params }: InstallationJobPageProps) {
  const { id } = await params;
  const [job, user] = await Promise.all([getInstallationJob(id), getCurrentUser()]);
  if (!job) notFound();

  const canAct =
    user?.role === "admin" ||
    (user?.branchId === job.branchId && (user?.isBranchManager || user?.canManageInstallations));

  const [originalPackage, allPackages] = await Promise.all([getComboPackage(job.comboPackageId), getComboPackages()]);
  const higherCapacityPackages = allPackages.filter(
    (p) => p.id !== job.comboPackageId && p.isActive && p.isVisibleOnWebsite && p.capacityRank > (originalPackage?.capacityRank ?? 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Order ${job.orderNumber}`} description={`${job.packageName} -- ${job.branchName ?? job.branchId}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{job.customerName}</p>
          {job.customerPhone && <p className="text-gray-500 dark:text-gray-400">{job.customerPhone}</p>}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(job.createdAt)}</p>
        </div>
        {job.inspectionNotes && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Inspection Notes</p>
            <p className="text-gray-800 dark:text-gray-200">{job.inspectionNotes}</p>
          </div>
        )}
      </div>

      {canAct ? (
        <InstallationJobActions job={job} higherCapacityPackages={higherCapacityPackages} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You can view this job, but only the Owner or this branch&apos;s Manager (or a permitted salesperson) can act on it.
        </p>
      )}

      <Link href="/dashboard/installation-jobs" className="text-sm font-semibold text-brand-green dark:text-emerald-400">
        ← Back to Installation Jobs
      </Link>
    </div>
  );
}
