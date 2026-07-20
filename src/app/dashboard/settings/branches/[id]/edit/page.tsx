import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { BranchForm } from "@/components/settings/BranchForm";
import { updateBranch } from "@/app/dashboard/settings/branches/actions";
import { getBranch } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/dashboard/settings");

  const { id } = await params;
  const branch = await getBranch(id);

  if (!branch) notFound();

  const updateBranchWithId = updateBranch.bind(null, branch.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Branch"
        description={`Update details for ${branch.name}.`}
      />
      <BranchForm action={updateBranchWithId} initialValues={branch} submitLabel="Save Changes" />
    </div>
  );
}
