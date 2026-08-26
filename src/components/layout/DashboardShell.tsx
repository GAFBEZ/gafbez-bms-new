"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { IdleLogout } from "@/components/layout/IdleLogout";
import type { Branch } from "@/types";
import type { CurrentUser } from "@/lib/auth";

interface DashboardShellProps {
  children: ReactNode;
  branches: Branch[];
  activeBranchId: string;
  user: CurrentUser | null;
  unreadNotificationCount: number;
  logoUrl: string | null;
  businessName: string;
}

export function DashboardShell({
  children,
  branches,
  activeBranchId,
  user,
  unreadNotificationCount,
  logoUrl,
  businessName,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const canManageInstallationProjects = isAdmin || Boolean(user?.isBranchManager) || Boolean(user?.canManageInstallations);
  const canReviewInstallerApplications = isAdmin || Boolean(user?.canTempApproveInstallers);

  return (
    <div className="flex min-h-screen bg-page print:block print:min-h-0 print:bg-white">
      <IdleLogout />
      <div className="print:hidden">
        <Sidebar
          isAdmin={isAdmin}
          canManageInstallationProjects={canManageInstallationProjects}
          canReviewInstallerApplications={canReviewInstallerApplications}
          logoUrl={logoUrl}
          businessName={businessName}
        />
      </div>
      <div className="print:hidden">
        <MobileNav
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          isAdmin={isAdmin}
          canManageInstallationProjects={canManageInstallationProjects}
          canReviewInstallerApplications={canReviewInstallerApplications}
          logoUrl={logoUrl}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <div className="print:hidden">
          <Header
            onMenuClick={() => setMobileNavOpen(true)}
            branches={branches}
            activeBranchId={activeBranchId}
            user={user}
            unreadNotificationCount={unreadNotificationCount}
          />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
