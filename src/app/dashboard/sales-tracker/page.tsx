import Link from "next/link";
import { Calculator, PiggyBank, Receipt, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { BranchSalesChart } from "@/components/sales/BranchSalesChart";
import { StaffSalesChart } from "@/components/sales/StaffSalesChart";
import { TopProductsChart } from "@/components/sales/TopProductsChart";
import { SalesTrendChart } from "@/components/sales/SalesTrendChart";
import { SalesDateFilter } from "@/components/sales/SalesDateFilter";
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
import { formatCurrency } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { DASHBOARD_PALETTE } from "@/lib/palette";

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

export default async function SalesTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range: rawRange, from: rawFrom, to: rawTo } = await searchParams;

  const parsedFrom = parseDateParam(rawFrom);
  const parsedTo = parseDateParam(rawTo);
  const customRange = parsedFrom !== null || parsedTo !== null;

  let window: DateWindow;
  let trendWindow: DateWindow;
  let periodLabel: string;
  let range: RangeKey | null = null;

  if (customRange) {
    // Fill in a missing end with the one that's set, and swap if reversed,
    // so "From" and "To" always resolve to a sane, inclusive range.
    let from = parsedFrom ?? parsedTo!;
    let to = parsedTo ?? parsedFrom!;
    if (to < from) [from, to] = [to, from];

    window = rangeToWindow(from, to);
    trendWindow = window;
    periodLabel =
      from.getTime() === to.getTime() ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  } else {
    range = isRangeKey(rawRange) ? rawRange : "30d";
    window = daysToWindow(range === "all" ? undefined : RANGE_DAYS[range]);
    trendWindow = daysToWindow(RANGE_DAYS[range]);
    periodLabel = RANGE_LABELS[range];
  }

  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const [summary, byBranch, byStaff, topProducts, trend] = await Promise.all([
    getSalesSummary(window),
    getSalesByBranch(window),
    isAdmin ? getSalesByStaff(window) : Promise.resolve(null),
    getTopProducts(window),
    getSalesTrend(trendWindow),
  ]);

  const dataIsLive = summary !== null && byBranch !== null && topProducts !== null && trend !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Tracker"
        description="Analyse sales trends and branch performance over time. Branch comparison here always covers every branch, regardless of the header's branch filter."
      />

      {!dataIsLive && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          Sales data isn&apos;t available right now — showing an empty view.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={key === "30d" ? "/dashboard/sales-tracker" : `/dashboard/sales-tracker?range=${key}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                !customRange && range === key
                  ? "bg-brand-green text-white"
                  : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {RANGE_LABELS[key]}
            </Link>
          ))}
        </div>

        <SalesDateFilter from={rawFrom} to={rawTo} />
      </div>

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <DashboardCard
          label="Total Sales"
          value={formatCurrency(summary?.totalSales ?? 0)}
          helperText={periodLabel}
          icon={ShoppingCart}
          accent={DASHBOARD_PALETTE.violet}
        />
        {isAdmin && (
          <DashboardCard
            label="Gross Profit"
            value={formatCurrency(summary?.grossProfit ?? 0)}
            helperText="Revenue minus cost of goods sold"
            icon={PiggyBank}
            accent={DASHBOARD_PALETTE.magentaDark}
          />
        )}
        <DashboardCard
          label="Transactions"
          value={(summary?.transactionCount ?? 0).toLocaleString("en-NG")}
          helperText={periodLabel}
          icon={Receipt}
          accent={DASHBOARD_PALETTE.orange}
        />
        <DashboardCard
          label="Average Sale"
          value={formatCurrency(summary?.averageSale ?? 0)}
          helperText={periodLabel}
          icon={Calculator}
          accent={DASHBOARD_PALETTE.blue}
        />
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <DashboardSection title="Sales by Branch">
          <BranchSalesChart data={byBranch ?? []} />
        </DashboardSection>

        <DashboardSection title="Top Products">
          <TopProductsChart data={topProducts ?? []} />
        </DashboardSection>

        {isAdmin && (
          <DashboardSection title="Sales by Staff">
            <StaffSalesChart data={byStaff ?? []} />
          </DashboardSection>
        )}
      </div>

      <DashboardSection title="Daily Sales Trend">
        <SalesTrendChart data={trend ?? []} />
      </DashboardSection>
    </div>
  );
}
