import { CalendarDays } from "lucide-react";

interface BonusMonthFilterProps {
  month: string;
  staffId?: string | null;
}

/**
 * Plain GET form -- no client JS needed, same pattern as SalesDateFilter.
 * Submitting navigates to /dashboard/daily-sales?tab=bonus&month=..., which
 * the page reads directly and SalesTabs lands on the Staff Bonus tab.
 */
export function BonusMonthFilter({ month, staffId }: BonusMonthFilterProps) {
  return (
    <form action="/dashboard/daily-sales" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tab" value="bonus" />
      {staffId && <input type="hidden" name="staff" value={staffId} />}

      <CalendarDays className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />

      <label htmlFor="bonus-month" className="sr-only">
        Month
      </label>
      <input
        id="bonus-month"
        type="month"
        name="month"
        defaultValue={month}
        max={new Date().toISOString().slice(0, 7)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      />

      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Apply
      </button>
    </form>
  );
}
