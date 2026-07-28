import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getAppSettings } from "@/lib/settings";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [branches, user, activeBranchId, unreadNotificationCount, appSettings] = await Promise.all([
    getBranches(),
    getCurrentUser(),
    getActiveBranchId(),
    getUnreadNotificationCount(),
    getAppSettings(),
  ]);

  // proxy.ts only checks for a valid session (any signed-in customer or
  // staff account), not an actual staff profile -- getCurrentUser() is the
  // one place that distinguishes them, so this is the real gate.
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      branches={branches}
      activeBranchId={activeBranchId}
      user={user}
      unreadNotificationCount={unreadNotificationCount ?? 0}
      logoUrl={appSettings.logoUrl}
      businessName={appSettings.businessName}
    >
      {children}
    </DashboardShell>
  );
}
