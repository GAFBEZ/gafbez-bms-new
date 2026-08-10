import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getInstallerApplications } from "@/lib/installerApplications";
import { getCurrentUser } from "@/lib/auth";
import InstallerApplicationRow from "@/components/installerApplications/InstallerApplicationRow";

/** Owner/Admin only -- approving an application silently switches that
 * customer's future website orders from products.website_price to
 * products.selling_price (see create_online_order_with_reservation,
 * 0039_installer_accounts.sql), the same financial-control tier as
 * Store Credit and combo package pricing, not a Manager-reviewable queue
 * like Refund Requests. */
export default async function InstallerApplicationsPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Installer Applications" />
        <EmptyState title="Owner/Admin only" description="Installer application review is restricted to Owner/Admin accounts." />
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {applications.map((application) => (
                <InstallerApplicationRow key={application.id} application={application} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
