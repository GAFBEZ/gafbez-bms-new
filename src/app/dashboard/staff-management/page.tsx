import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffTable } from "@/components/staff/StaffTable";
import { getStaffMembers } from "@/lib/staff";
import { getCurrentUser } from "@/lib/auth";

export default async function StaffManagementPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Staff Management"
          description="Manage staff accounts, roles, and branch assignments."
        />
        <EmptyState
          title="Admins only"
          description="Staff Management is restricted to admin accounts. Contact an administrator if you need changes made here."
        />
      </div>
    );
  }

  const staff = await getStaffMembers();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff Management"
        description="Manage staff names, roles, branch assignments, and access."
      />

      <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 shadow-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-green dark:text-emerald-400" aria-hidden="true" />
        <p>
          To add a new staff member, create their login in the Supabase Dashboard under{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">Authentication → Users</span> with their
          email and a temporary password. A profile appears here automatically — set their name,
          role, and branch below.
        </p>
      </div>

      <StaffTable staff={staff} currentUserId={user.id} />
    </div>
  );
}
