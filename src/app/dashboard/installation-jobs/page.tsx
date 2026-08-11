import { PageHeader } from "@/components/ui/PageHeader";
import { InstallationTabs } from "@/components/installations/InstallationTabs";
import { getInstallationJobs } from "@/lib/installationJobs";
import { getInstallations, getInstallationSummary } from "@/lib/installations";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function InstallationJobsPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const activeBranchId = await getActiveBranchId();

  const [jobs, installations, summary, branches] = await Promise.all([
    getInstallationJobs(),
    isAdmin ? getInstallations(activeBranchId) : Promise.resolve([]),
    isAdmin ? getInstallationSummary(activeBranchId) : Promise.resolve(null),
    isAdmin ? getBranches() : Promise.resolve([]),
  ]);
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Installation Jobs" description="Site-inspection and installation scheduling, and (Owner/Admin) cost vs. profit per job." />
      <InstallationTabs
        jobs={jobs}
        isAdmin={isAdmin}
        installations={installations}
        summary={summary}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
      />
    </div>
  );
}
