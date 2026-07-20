import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getLiveInventoryDashboardData,
  getLiveOutstandingBalance,
  getLiveTodaySales,
  getLiveNetProfit,
} from "@/lib/dashboard";
import { getStockMovements } from "@/lib/stockMovements";
import { getSales } from "@/lib/sales";
import { getSalesByBranch } from "@/lib/salesTracker";
import { getNotifications } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/auth";
import { BranchSalesChart } from "@/components/sales/BranchSalesChart";
import { formatCurrency } from "@/lib/format";
import {
  branchSales as demoBranchSales,
  dashboardMetrics,
  lowStockProducts as demoLowStockProducts,
  recentNotifications as demoNotifications,
  recentSales as demoRecentSales,
  recentStockMovements as demoStockMovements,
} from "@/lib/placeholder-data";
import type { DashboardMetricKey } from "@/types";

const notificationIconByType = {
  info: Info,
  warning: AlertTriangle,
  success: TrendingUp,
} as const;

const moneyKeys = new Set<DashboardMetricKey>([
  "inventoryValue",
  "expectedRevenue",
  "grossProfit",
  "outstandingBalance",
  "todaySales",
  "netProfit",
]);

/** Derived from cost price -- hidden from non-admins so staff never see margin/profit figures. */
const ADMIN_ONLY_METRIC_KEYS = new Set<DashboardMetricKey>([
  "inventoryValue",
  "expectedRevenue",
  "grossProfit",
  "netProfit",
]);

export default async function DashboardPage() {
  const [
    live,
    liveStockMovements,
    liveOutstandingBalance,
    liveTodaySales,
    liveSales,
    liveBranchSales,
    liveNetProfit,
    liveNotifications,
    user,
  ] = await Promise.all([
    getLiveInventoryDashboardData(),
    getStockMovements(4),
    getLiveOutstandingBalance(),
    getLiveTodaySales(),
    getSales(4),
    getSalesByBranch(),
    getLiveNetProfit(),
    getNotifications(5),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";

  const liveMetrics: Partial<Record<DashboardMetricKey, number>> = {
    ...live?.metrics,
    ...(liveOutstandingBalance !== null
      ? { outstandingBalance: liveOutstandingBalance }
      : {}),
    ...(liveTodaySales !== null ? { todaySales: liveTodaySales } : {}),
    ...(liveNetProfit !== null ? { netProfit: liveNetProfit } : {}),
  };

  const visibleMetrics = isAdmin
    ? dashboardMetrics
    : dashboardMetrics.filter((metric) => !ADMIN_ONLY_METRIC_KEYS.has(metric.key));

  const metrics = visibleMetrics.map((metric) => {
    const liveValue = liveMetrics[metric.key];
    if (liveValue === undefined) {
      return { ...metric, helperText: `${metric.helperText} (Demo)` };
    }
    return {
      ...metric,
      value: moneyKeys.has(metric.key)
        ? formatCurrency(liveValue)
        : liveValue.toLocaleString("en-NG"),
      isLive: true,
    };
  });

  const branchSalesAreLive = liveBranchSales !== null;

  const lowStockProducts = live?.lowStockProducts ?? demoLowStockProducts;
  const lowStockIsLive = live !== null;

  const recentSalesAreLive = liveSales !== null;
  const recentSaleRows = recentSalesAreLive
    ? liveSales.map((sale) => ({
        id: sale.id,
        customer: sale.customerName ?? "Walk-in customer",
        branch: sale.branchName,
        amountLabel: formatCurrency(sale.totalAmount),
        dateLabel: new Date(sale.createdAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      }))
    : demoRecentSales.map((sale) => ({
        id: sale.id,
        customer: sale.customer,
        branch: sale.branch,
        amountLabel: sale.amount,
        dateLabel: sale.date,
      }));

  const notificationsAreLive = liveNotifications !== null;
  const notificationRows = notificationsAreLive
    ? liveNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        message: notification.message,
        timeLabel: new Date(notification.createdAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      }))
    : demoNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        message: notification.message,
        timeLabel: notification.time,
      }));

  const stockMovementsAreLive = liveStockMovements !== null;
  const stockMovementRows = stockMovementsAreLive
    ? liveStockMovements.map((movement) => ({
        id: movement.id,
        product: movement.productName,
        type: movement.type,
        quantityLabel: `${movement.type === "in" ? "+" : "-"}${movement.quantity}`,
        dateLabel: new Date(movement.createdAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      }))
    : demoStockMovements.map((movement) => ({
        id: movement.id,
        product: movement.product,
        type: movement.type,
        quantityLabel: movement.quantity,
        dateLabel: movement.date,
      }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Overview of business performance across all branches."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map(({ key, ...metric }) => (
          <DashboardCard key={key} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardSection
          title={branchSalesAreLive ? "Sales by Branch" : "Sales by Branch (Demo)"}
          viewAllHref="/dashboard/sales-tracker"
        >
          {branchSalesAreLive ? (
            <BranchSalesChart data={liveBranchSales} />
          ) : (
            <ul className="flex flex-col gap-3">
              {demoBranchSales.map((row) => (
                <li key={row.branch}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{row.branch}</span>
                    <span className="text-gray-500 dark:text-gray-400">{row.amount}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-brand-green"
                      style={{ width: `${row.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title={recentSalesAreLive ? "Recent Sales" : "Recent Sales (Demo)"}
          viewAllHref="/dashboard/daily-sales"
        >
          {recentSaleRows.length === 0 ? (
            <EmptyState
              title="No sales recorded yet"
              description="Recorded sales will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentSaleRows.map((sale) => (
                <li
                  key={sale.id}
                  className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{sale.customer}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {sale.branch} &middot; {sale.dateLabel}
                    </p>
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{sale.amountLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title={
            stockMovementsAreLive
              ? "Recent Stock Movements"
              : "Recent Stock Movements (Demo)"
          }
          viewAllHref="/dashboard/stock-movement"
        >
          {stockMovementRows.length === 0 ? (
            <EmptyState
              title="No stock movements yet"
              description="Recorded movements will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {stockMovementRows.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{movement.product}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{movement.dateLabel}</p>
                  </div>
                  <span
                    className={`font-medium ${
                      movement.type === "in" ? "text-brand-green dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {movement.quantityLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title={lowStockIsLive ? "Low Stock Products" : "Low Stock Products (Demo)"}
          viewAllHref="/dashboard/inventory"
        >
          {lowStockProducts.length === 0 ? (
            <EmptyState
              title="Nothing low on stock"
              description="Every active product is currently above its reorder level."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {lowStockProducts.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <p className="font-medium text-gray-800 dark:text-gray-200">{product.product}</p>
                  <span className="rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {product.remaining} left of {product.threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title={notificationsAreLive ? "Recent Notifications" : "Recent Notifications (Demo)"}
          viewAllHref="/dashboard/notifications"
        >
          {notificationRows.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="Posted notifications will show up here."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {notificationRows.map((notification) => {
                const Icon = notificationIconByType[notification.type];
                return (
                  <li key={notification.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green-soft text-brand-green dark:text-emerald-400">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-gray-700 dark:text-gray-300">{notification.message}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{notification.timeLabel}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
