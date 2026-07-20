import type { ReactNode } from "react";
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
