import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import InstallationProjectTable from "@/components/installationProjects/InstallationProjectTable";
import { getInstallationProjects } from "@/lib/installationProjects";
import { getCurrentUser } from "@/lib/auth";

/** Nav-gated to Owner/Manager (managerOrAdmin, src/lib/navigation.ts), but
 * this page double-checks with getCurrentUser() too, in case a salesperson
 * navigates here directly by URL -- the underlying RPCs would reject their
 * writes regardless, but the page itself should not offer controls it
 * knows will fail. */
export default async function InstallationProjectsPage() {
  const [projects, user] = await Promise.all([getInstallationProjects(), getCurrentUser()]);
  const canEdit = user?.role === "admin" || Boolean(user?.isBranchManager) || Boolean(user?.canManageInstallations);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Installation Projects" />
        <EmptyState title="Owner/Manager only" description="Only the Owner or a branch Manager can manage the public installation gallery." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Installation Projects"
        description="Manage the public marketing gallery shown on the homepage and /installations."
        actions={
          <Link
            href="/dashboard/installation-projects/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Project
          </Link>
        }
      />

      <InstallationProjectTable projects={projects} canEdit={canEdit} />
    </div>
  );
}
