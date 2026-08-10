import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getInstallerApplications } from "@/lib/installerApplications";
import { getCurrentUser } from "@/lib/auth";
import InstallerApplicationRow from "@/components/installerApplications/InstallerApplicationRow";

/** Owner/Admin, or a staff member with profiles.can_temp_approve_installers
 * (0042_installer_temp_approval.sql) -- a permanent approve/reject is
 * still Owner/Admin only (switches future orders from
 * products.website_price to products.selling_price, the same
 * financial-control tier as Store Credit), but a designated trusted
 * staff member can grant a 72-hour provisional temp-approve so an
 * installer isn't stuck waiting on a specific person to be online. */
export default async function InstallerApplicationsPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const canTempApprove = isAdmin || Boolean(user?.canTempApproveInstallers);

  if (!canTempApprove) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Installer Applications" />
        <EmptyState
          title="Restricted"
          description="Installer application review is restricted to Owner/Admin accounts and staff specifically granted temporary-approval access."
        />
      </div>
    );
  }

  const applications = await getInstallerApplications();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Installer Applications"
        description="Customers who signed up as installers. Approving switches their future website orders to internal/wholesale pricing -- invisibly, nothing changes in what they see while shopping."
      />

      {applications.length === 0 ? (
        <EmptyState title="No installer applications" description={'Customers who check "I\'m an installer" at signup will appear here.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Business Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Profiles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {applications.map((application) => (
                <InstallerApplicationRow key={application.id} application={application} canFinalApprove={isAdmin} canTempApprove={canTempApprove} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
