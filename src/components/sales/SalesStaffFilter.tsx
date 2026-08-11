"use client";

import { Users } from "lucide-react";

interface SalesStaffFilterProps {
  staffId: string | null;
  staffOptions: { id: string; name: string }[];
  range: string | undefined;
  from: string | undefined;
  to: string | undefined;
}

const selectClasses =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300";

/**
 * Admin-only "slicer" for the Sales Tracker tab -- narrows the summary
 * cards, Sales by Branch, Top Products, and Daily Sales Trend to one
 * salesperson (see the staffId param threaded through src/lib/
 * salesTracker.ts). The Sales by Staff comparison chart is deliberately
 * left unaffected -- it's the "pick who to drill into" view.
 *
 * Plain GET form (same no-client-JS-required pattern as SalesDateFilter)
 * except for the auto-submit-on-change, since a <select> doesn't submit
 * itself. Hidden inputs mirror the current range/from/to so switching
 * salesperson doesn't drop the active date filter.
 */
export function SalesStaffFilter({ staffId, staffOptions, range, from, to }: SalesStaffFilterProps) {
  return (
    <form action="/dashboard/daily-sales" className="flex flex-wrap items-center gap-2">
      <Users className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />

      {range && <input type="hidden" name="range" value={range} />}
      {from && <input type="hidden" name="from" value={from} />}
      {to && <input type="hidden" name="to" value={to} />}

      <label htmlFor="sales-staff-filter" className="sr-only">
        Filter by salesperson
      </label>
      <select
        id="sales-staff-filter"
        name="staff"
        defaultValue={staffId ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={selectClasses}
      >
        <option value="">All staff</option>
        {staffOptions.map((staff) => (
          <option key={staff.id} value={staff.id}>
            {staff.name}
          </option>
        ))}
      </select>
    </form>
  );
}
