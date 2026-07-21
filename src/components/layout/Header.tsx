import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { BranchSelector } from "@/components/ui/BranchSelector";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import { signOut } from "@/app/dashboard/actions";
import type { Branch } from "@/types";
import type { CurrentUser } from "@/lib/auth";

interface HeaderProps {
  onMenuClick: () => void;
  branches: Branch[];
  activeBranchId: string;
  user: CurrentUser | null;
  unreadNotificationCount: number;
}

function getInitials(user: CurrentUser): string {
  const source = user.fullName || user.email;
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function Header({
  onMenuClick,
  branches,
  activeBranchId,
  user,
  unreadNotificationCount,
}: HeaderProps) {
  const displayName = user?.fullName || user?.email || "Signed in";

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 shrink-0 items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-md p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green/30 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="hidden md:block">
        <BranchSelector branches={branches} activeBranchId={activeBranchId} />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="min-w-0 md:hidden">
          <BranchSelector branches={branches} activeBranchId={activeBranchId} />
        </div>

        <Link
          href="/dashboard/notifications"
          aria-label="View notifications"
          className="relative rounded-md p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <NotificationBadge count={unreadNotificationCount} />
        </Link>

        {user && (
          <Link
            href="/dashboard/account"
            aria-label="My Account"
            className="hidden items-center gap-2.5 rounded-md border-l border-gray-200 dark:border-gray-700 pl-4 sm:flex hover:opacity-80"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green-soft text-sm font-semibold text-brand-green dark:text-emerald-400"
              aria-hidden="true"
            >
              {getInitials(user)}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatRole(user.role)}</p>
            </div>
          </Link>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
