"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
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

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar isAdmin={isAdmin} logoUrl={logoUrl} businessName={businessName} />
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        isAdmin={isAdmin}
        logoUrl={logoUrl}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileNavOpen(true)}
          branches={branches}
          activeBranchId={activeBranchId}
          user={user}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
