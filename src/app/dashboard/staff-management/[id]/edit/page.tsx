import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffForm } from "@/components/staff/StaffForm";
import { updateStaffMember } from "@/app/dashboard/staff-management/actions";
import { getStaffMember } from "@/lib/staff";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function EditStaffMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Staff Member" description="Admins only." />
        <EmptyState
          title="Admins only"
          description="Staff Management is restricted to admin accounts."
        />
      </div>
    );
  }

  const [member, branches] = await Promise.all([getStaffMember(id), getBranches()]);

  if (!member) notFound();

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const updateStaffMemberWithId = updateStaffMember.bind(null, member.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Staff Member"
        description={`Update details for ${member.fullName || member.email || "this staff member"}.`}
      />
      <StaffForm
        action={updateStaffMemberWithId}
        branches={operationalBranches}
        member={member}
        isSelf={member.id === user.id}
      />
    </div>
  );
}
