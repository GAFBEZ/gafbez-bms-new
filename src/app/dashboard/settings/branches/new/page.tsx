import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { BranchForm } from "@/components/settings/BranchForm";
import { createBranch } from "@/app/dashboard/settings/branches/actions";
import { getCurrentUser } from "@/lib/auth";

export default async function NewBranchPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/dashboard/settings");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add Branch"
        description="Create a new GAFBEZ Energies branch."
      />
      <BranchForm action={createBranch} submitLabel="Add Branch" />
    </div>
  );
}
