import type { ReactNode } from "react";
import Link from "next/link";

interface DashboardSectionProps {
  title: string;
  /** Short muted note under the title -- e.g. clarifying that this
   * section's figures are gross where a sibling summary card nearby is
   * net of returns, so the two not matching isn't a bug. */
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
}

export function DashboardSection({
  title,
  subtitle,
  viewAllHref,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
        </div>
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
