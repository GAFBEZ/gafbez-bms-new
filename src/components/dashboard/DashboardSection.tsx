import type { ReactNode } from "react";
import Link from "next/link";

interface DashboardSectionProps {
  title: string;
  viewAllHref?: string;
  children: ReactNode;
}

export function DashboardSection({
  title,
  viewAllHref,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-brand-green dark:text-emerald-400 hover:underline"
          >
            View all
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
