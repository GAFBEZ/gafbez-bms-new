import Link from "next/link";
import { CalendarDays } from "lucide-react";

interface SalesDateFilterProps {
  from?: string;
  to?: string;
}

const inputClasses =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300";

/**
 * Plain GET form -- no client JS needed. Submitting navigates to
 * /dashboard/sales-tracker?from=...&to=..., which the page reads directly.
 * Pick the same date in both fields for a single day.
 */
export function SalesDateFilter({ from, to }: SalesDateFilterProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action="/dashboard/sales-tracker" className="flex flex-wrap items-center gap-2">
      <CalendarDays
        className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
        aria-hidden="true"
      />

      <label htmlFor="sales-tracker-from" className="sr-only">
        From
      </label>
      <input
        id="sales-tracker-from"
        type="date"
        name="from"
        defaultValue={from}
        max={today}
        className={inputClasses}
      />

      <span className="text-sm text-gray-400 dark:text-gray-500">to</span>

      <label htmlFor="sales-tracker-to" className="sr-only">
        To
      </label>
      <input
        id="sales-tracker-to"
        type="date"
        name="to"
        defaultValue={to}
        max={today}
        className={inputClasses}
      />

      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Apply
      </button>

      {(from || to) && (
        <Link
          href="/dashboard/sales-tracker"
          className="text-xs font-medium text-brand-green hover:underline dark:text-emerald-400"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
