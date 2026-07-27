import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import InstallationProjectForm from "@/components/installationProjects/InstallationProjectForm";
import { createInstallationProject } from "../actions";
import { getCurrentUser } from "@/lib/auth";

export default async function NewInstallationProjectPage() {
  const user = await getCurrentUser();
  const canEdit = user?.role === "admin" || Boolean(user?.isBranchManager) || Boolean(user?.canManageInstallations);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="New Installation Project" />
        <EmptyState title="Owner/Manager only" description="Only the Owner or a branch Manager can create installation projects." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New Installation Project" description="Add a case study to the public installation gallery. Upload images after saving." />
      <InstallationProjectForm action={createInstallationProject} submitLabel="Create Project" />
    </div>
  );
}
