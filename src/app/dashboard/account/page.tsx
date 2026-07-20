import { PageHeader } from "@/components/ui/PageHeader";
import { AccountProfileForm } from "@/components/account/AccountProfileForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { getStaffMember } from "@/lib/staff";

export default async function AccountPage() {
  const user = await getCurrentUser();
  const profile = user ? await getStaffMember(user.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Account" description="Your profile and password." />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile</h2>
        <div className="mt-4">
          <AccountProfileForm
            fullName={profile?.fullName ?? null}
            email={profile?.email ?? user?.email ?? null}
            role={profile?.role ?? "staff"}
            branchName={profile?.branchName ?? null}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Change Password
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Requires your current password. If you&apos;ve forgotten it, ask an
          administrator to reset it from the Supabase Dashboard.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
