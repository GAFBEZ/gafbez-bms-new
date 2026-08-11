import { PageHeader } from "@/components/ui/PageHeader";
import { SalesTabs } from "@/components/sales/SalesTabs";
import { getSales } from "@/lib/sales";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";
import { getStaffOptions } from "@/lib/staff";
import {
  getSalesByBranch,
  getSalesByStaff,
  getTopProducts,
  getSalesSummary,
  getSalesTrend,
  daysToWindow,
  rangeToWindow,
  type DateWindow,
} from "@/lib/salesTracker";

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 90, // trend chart still needs a bounded window; summary/by-branch below use no cutoff for "all"
};

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

function isRangeKey(value: string | undefined): value is RangeKey {
  return value === "7d" || value === "30d" || value === "90d" || value === "all";
}

/** "2026-07-10" -> local midnight Date, or null if malformed/invalid. */
function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Merged "Daily Sales" (entry/ledger) + "Sales Tracker" (analytics) --
 * same public.sales data, two different views, folded into one sidebar
 * item as tabs (see SalesTabs). All the date-window/searchParams parsing
 * below is unchanged from the old standalone /dashboard/sales-tracker
 * page -- only relocated here so those Links can point at this route
 * instead.
 */
export default async function DailySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; staff?: string }>;
}) {
  const { range: rawRange, from: rawFrom, to: rawTo, staff: rawStaff } = await searchParams;

  const parsedFrom = parseDateParam(rawFrom);
  const parsedTo = parseDateParam(rawTo);
  const customRange = parsedFrom !== null || parsedTo !== null;

  let window: DateWindow;
  let trendWindow: DateWindow;
  let periodLabel: string;
  let range: RangeKey | null = null;

  if (customRange) {
    let from = parsedFrom ?? parsedTo!;
    let to = parsedTo ?? parsedFrom!;
    if (to < from) [from, to] = [to, from];

    window = rangeToWindow(from, to);
    trendWindow = window;
    periodLabel = from.getTime() === to.getTime() ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  } else {
    range = isRangeKey(rawRange) ? rawRange : "30d";
    window = daysToWindow(range === "all" ? undefined : RANGE_DAYS[range]);
    trendWindow = daysToWindow(RANGE_DAYS[range]);
    periodLabel = RANGE_LABELS[range];
  }

  const activeBranchId = await getActiveBranchId();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  // Staff slicer is admin-only, matching the existing Sales by Staff/Gross
  // Profit gating -- a non-admin's ?staff= param (if somehow present) is
  // simply ignored rather than applied.
  const staffId = isAdmin && rawStaff ? rawStaff : null;

  const [sales, branches, staffOptions, summary, byBranch, byStaff, topProducts, trend] = await Promise.all([
    getSales(100, activeBranchId),
    getBranches(),
    isAdmin ? getStaffOptions() : Promise.resolve([]),
    getSalesSummary(window, staffId ?? undefined),
    getSalesByBranch(window, staffId ?? undefined),
    isAdmin ? getSalesByStaff(window) : Promise.resolve(null),
    getTopProducts(window, 8, staffId ?? undefined),
    getSalesTrend(trendWindow, staffId ?? undefined),
  ]);

  const dataIsLive = summary !== null && byBranch !== null && topProducts !== null && trend !== null;
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const hasTrackerParams = Boolean(rawRange || rawFrom || rawTo || rawStaff);
  const staffName = staffId ? (staffOptions.find((s) => s.id === staffId)?.name ?? "Former staff member") : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Daily Sales" description="Record and review sales, and analyse trends and branch performance over time." />
      <SalesTabs
        initialTab={hasTrackerParams ? "tracker" : "daily"}
        sales={sales ?? []}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
        isAdmin={isAdmin}
        dataIsLive={dataIsLive}
        summary={summary}
        byBranch={byBranch}
        byStaff={byStaff}
        topProducts={topProducts}
        trend={trend}
        periodLabel={periodLabel}
        range={range}
        customRange={customRange}
        rawFrom={rawFrom}
        rawTo={rawTo}
        staffId={staffId}
        staffName={staffName}
        staffOptions={staffOptions}
      />
    </div>
  );
}
