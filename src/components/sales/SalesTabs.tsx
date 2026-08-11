"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Plus, Calculator, PiggyBank, Receipt, ShoppingCart } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import { SaleTable } from "@/components/sales/SaleTable";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { BranchSalesChart } from "@/components/sales/BranchSalesChart";
import { StaffSalesChart } from "@/components/sales/StaffSalesChart";
import { TopProductsChart } from "@/components/sales/TopProductsChart";
import { SalesTrendChart } from "@/components/sales/SalesTrendChart";
import { SalesDateFilter } from "@/components/sales/SalesDateFilter";
import { SalesStaffFilter } from "@/components/sales/SalesStaffFilter";
import { formatCurrency } from "@/lib/format";
import { DASHBOARD_PALETTE } from "@/lib/palette";
import type { Sale, BranchSalesSummary, StaffSalesSummary, TopProductSummary, SalesTrendPoint, SalesSummary } from "@/types";

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

interface SalesTabsProps {
  initialTab: "daily" | "tracker";
  // Daily Sales tab
  sales: Sale[];
  activeBranchId: string;
  activeBranchName: string | undefined;
  // Sales Tracker tab
  isAdmin: boolean;
  dataIsLive: boolean;
  summary: SalesSummary | null;
  byBranch: BranchSalesSummary[] | null;
  byStaff: StaffSalesSummary[] | null;
  topProducts: TopProductSummary[] | null;
  trend: SalesTrendPoint[] | null;
  periodLabel: string;
  range: RangeKey | null;
  customRange: boolean;
  rawFrom: string | undefined;
  rawTo: string | undefined;
  // Staff slicer (admin only)
  staffId: string | null;
  staffName: string | null;
  staffOptions: { id: string; name: string }[];
}

/**
 * "Daily Sales" (entry/ledger) and "Sales Tracker" (analytics over the
 * same public.sales data) folded into one sidebar item -- same
 * tablist/tabpanel pattern as CustomerTabs/ProductEditTabs. Both tabs'
 * data is fetched unconditionally by the parent Server Component
 * (page.tsx) and passed down as plain props, same as CustomerTabs, so a
 * tab switch never triggers a fresh request.
 *
 * initialTab defaults to "tracker" when the URL already carries a
 * range/from/to param (a Sales Tracker date-filter link was clicked) --
 * otherwise a filter click would navigate to new tracker data while the
 * tab silently stayed on "Daily Sales".
 */
export function SalesTabs({
  initialTab,
  sales,
  activeBranchId,
  activeBranchName,
  isAdmin,
  dataIsLive,
  summary,
  byBranch,
  byStaff,
  topProducts,
  trend,
  periodLabel,
  range,
  customRange,
  rawFrom,
  rawTo,
  staffId,
  staffName,
  staffOptions,
}: SalesTabsProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "tracker">(initialTab);
  const dailyTabId = useId();
  const trackerTabId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Sales views" className="flex gap-2">
          <TabButton id={dailyTabId} isActive={activeTab === "daily"} ariaControls="daily-sales-panel" onClick={() => setActiveTab("daily")}>
            Daily Sales
          </TabButton>
          <TabButton id={trackerTabId} isActive={activeTab === "tracker"} ariaControls="sales-tracker-panel" onClick={() => setActiveTab("tracker")}>
            Sales Tracker
          </TabButton>
        </div>

        {activeTab === "daily" && (
          <Link
            href="/dashboard/daily-sales/new"
            className="mb-2 flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record Sale
          </Link>
        )}
      </div>

      <div id="daily-sales-panel" role="tabpanel" aria-labelledby={dailyTabId} hidden={activeTab !== "daily"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeBranchId === "all" || !activeBranchName
            ? "Record and review each branch's daily sales transactions."
            : `Showing sales for ${activeBranchName}. Switch branches from the selector above to see others.`}
        </p>
        <SaleTable sales={sales} />
      </div>

      <div id="sales-tracker-panel" role="tabpanel" aria-labelledby={trackerTabId} hidden={activeTab !== "tracker"} className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Analyse sales trends and branch performance over time
          {staffName ? `, filtered to ${staffName}` : ""}. Branch comparison here always covers every branch, regardless of the header&apos;s branch filter.
        </p>

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
                href={
                  (key === "30d" ? "/dashboard/daily-sales" : `/dashboard/daily-sales?range=${key}`) +
                  (staffId ? `${key === "30d" ? "?" : "&"}staff=${staffId}` : "")
                }
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

          <SalesDateFilter from={rawFrom} to={rawTo} staffId={staffId} />

          {isAdmin && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <SalesStaffFilter staffId={staffId} staffOptions={staffOptions} range={range ?? undefined} from={rawFrom} to={rawTo} />
            </div>
          )}
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
          <DashboardSection title={staffName ? `Sales by Branch — ${staffName}` : "Sales by Branch"}>
            <BranchSalesChart data={byBranch ?? []} />
          </DashboardSection>

          <DashboardSection title={staffName ? `Top Products — ${staffName}` : "Top Products"}>
            <TopProductsChart data={topProducts ?? []} />
          </DashboardSection>

          {isAdmin && (
            <DashboardSection title="Sales by Staff">
              <StaffSalesChart data={byStaff ?? []} />
            </DashboardSection>
          )}
        </div>

        <DashboardSection title={staffName ? `Daily Sales Trend — ${staffName}` : "Daily Sales Trend"}>
          <SalesTrendChart data={trend ?? []} />
        </DashboardSection>
      </div>
    </div>
  );
}
