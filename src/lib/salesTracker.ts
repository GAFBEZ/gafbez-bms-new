import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type {
  BranchSalesSummary,
  SalesSummary,
  SalesTrendPoint,
  StaffSalesSummary,
  TopProductSummary,
} from "@/types";

interface SaleAggregateRow {
  branch_id: string;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  branches: { name: string } | null;
}

interface SaleItemCogsRow {
  quantity: number;
  unit_cost: number;
}

interface ReturnAggregateRow {
  quantity: number;
  sale_items: { unit_price: number; unit_cost: number } | null;
}

interface ReturnTotals {
  value: number;
  cogs: number;
}

/** Optional lower/upper bound on `created_at`. `until` is exclusive. */
export interface DateWindow {
  since?: Date;
  until?: Date;
}

export function daysToWindow(days?: number): DateWindow {
  if (days === undefined) return {};
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return { since };
}

/**
 * An inclusive calendar-day range, local time: [from 00:00, day-after-to
 * 00:00). Pass the same date for both to get a single day.
 */
export function rangeToWindow(from: Date, to: Date): DateWindow {
  const since = new Date(from);
  since.setHours(0, 0, 0, 0);
  const until = new Date(to);
  until.setHours(0, 0, 0, 0);
  until.setDate(until.getDate() + 1);
  return { since, until };
}

async function fetchSales(window: DateWindow): Promise<SaleAggregateRow[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("branch_id, total_amount, created_at, created_by, branches(name)");

  if (window.since) query = query.gte("created_at", window.since.toISOString());
  if (window.until) query = query.lt("created_at", window.until.toISOString());

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load sales for tracker:", error?.message);
    return null;
  }

  return data as unknown as SaleAggregateRow[];
}

/**
 * Sum of quantity * unit_cost across every line item of every sale in the
 * window -- cost of goods sold. Joined via `sales!inner(created_at)` so the
 * date filter applies to the sale's date, not some column on sale_items
 * itself (which has none).
 */
async function fetchCogs(window: DateWindow): Promise<number | null> {
  const supabase = await createClient();
  let query = supabase.from("sale_items").select("quantity, unit_cost, sales!inner(created_at)");

  if (window.since) query = query.gte("sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sales.created_at", window.until.toISOString());

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load cost of goods sold:", error?.message);
    return null;
  }

  return (data as unknown as SaleItemCogsRow[]).reduce(
    (sum, row) => sum + row.quantity * Number(row.unit_cost),
    0,
  );
}

/**
 * Revenue and cost value of returns in the window, both attributed to the
 * *original sale's* date (not the return's own date) so a return simply
 * nets against the sale it belongs to rather than needing its own separate
 * time bucket. Double-nested filter (sale_returns -> sale_items -> sales)
 * for the same reason fetchCogs needs one level of it.
 */
async function fetchReturns(window: DateWindow): Promise<ReturnTotals | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sale_returns")
    .select("quantity, sale_items!inner(unit_price, unit_cost, sales!inner(created_at))");

  if (window.since) query = query.gte("sale_items.sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sale_items.sales.created_at", window.until.toISOString());

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load returns:", error?.message);
    return null;
  }

  return (data as unknown as ReturnAggregateRow[]).reduce<ReturnTotals>(
    (acc, row) => ({
      value: acc.value + row.quantity * Number(row.sale_items?.unit_price ?? 0),
      cogs: acc.cogs + row.quantity * Number(row.sale_items?.unit_cost ?? 0),
    }),
    { value: 0, cogs: 0 },
  );
}

/**
 * Always aggregates across every branch, regardless of the global branch
 * filter — a branch comparison is the point of this chart, so scoping it
 * to one branch would leave a single trivial bar. Pass a days-based window,
 * a rangeToWindow() for a picked date range, or {} for all-time.
 */
export async function getSalesByBranch(
  window: DateWindow = {},
): Promise<BranchSalesSummary[] | null> {
  const rows = await fetchSales(window);
  if (!rows) return null;

  const totals = new Map<string, BranchSalesSummary>();
  for (const row of rows) {
    const existing = totals.get(row.branch_id);
    const amount = Number(row.total_amount);
    if (existing) {
      existing.total += amount;
    } else {
      totals.set(row.branch_id, {
        branchId: row.branch_id,
        branchName: row.branches?.name ?? "Unknown branch",
        total: amount,
      });
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

/**
 * Aggregates sales by the staff member who recorded them, across every
 * branch (same "always all-branch" reasoning as getSalesByBranch). A sale
 * with no `created_by` (recorded before Staff Attribution shipped, or by a
 * deleted account) is grouped under "Unattributed" rather than dropped.
 */
export async function getSalesByStaff(
  window: DateWindow = {},
): Promise<StaffSalesSummary[] | null> {
  const [rows, staffNames] = await Promise.all([fetchSales(window), getStaffNameMap()]);
  if (!rows) return null;

  const totals = new Map<string, StaffSalesSummary>();
  for (const row of rows) {
    const key = row.created_by ?? "unattributed";
    const amount = Number(row.total_amount);
    const existing = totals.get(key);
    if (existing) {
      existing.total += amount;
      existing.transactionCount += 1;
    } else {
      totals.set(key, {
        staffId: row.created_by,
        staffName: row.created_by ? (staffNames[row.created_by] ?? "Former staff member") : "Unattributed",
        total: amount,
        transactionCount: 1,
      });
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

interface SaleItemProductRow {
  product_id: string;
  quantity: number;
  unit_price: number;
  products: { name: string; sku: string } | null;
}

/**
 * Top products by revenue in the window, gross (not net of returns -- same
 * "activity view" reasoning as getSalesByBranch/getSalesByStaff above, not
 * the profitability summary). Always company-wide, same as the other by-X
 * breakdowns on this page. Joined via `sales!inner(created_at)` so the date
 * filter applies to the sale's date, same technique as fetchCogs.
 */
export async function getTopProducts(
  window: DateWindow = {},
  limit = 8,
): Promise<TopProductSummary[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sale_items")
    .select("product_id, quantity, unit_price, products(name, sku), sales!inner(created_at)");

  if (window.since) query = query.gte("sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sales.created_at", window.until.toISOString());

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load top products:", error?.message);
    return null;
  }

  const totals = new Map<string, TopProductSummary>();
  for (const row of data as unknown as SaleItemProductRow[]) {
    const existing = totals.get(row.product_id);
    const revenue = row.quantity * Number(row.unit_price);
    if (existing) {
      existing.quantitySold += row.quantity;
      existing.revenue += revenue;
    } else {
      totals.set(row.product_id, {
        productId: row.product_id,
        productName: row.products?.name ?? "Unknown product",
        sku: row.products?.sku ?? "—",
        quantitySold: row.quantity,
        revenue,
      });
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Buckets sales by day across the window, which must be bounded on both
 * ends (a trend chart needs a fixed set of day-buckets to plot, unlike the
 * summary/by-branch queries above, which are happy with an unbounded
 * "since"). One bucket per day in the range, including days with zero
 * sales, so the chart doesn't skip gaps.
 */
export async function getSalesTrend(window: DateWindow): Promise<SalesTrendPoint[] | null> {
  if (!window.since || !window.until) return null;

  const rows = await fetchSales(window);
  if (!rows) return null;

  const totals = new Map<string, number>();
  for (const cursor = new Date(window.since); cursor < window.until; cursor.setDate(cursor.getDate() + 1)) {
    totals.set(cursor.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const dateKey = row.created_at.slice(0, 10);
    if (totals.has(dateKey)) {
      totals.set(dateKey, (totals.get(dateKey) ?? 0) + Number(row.total_amount));
    }
  }

  return Array.from(totals.entries()).map(([date, total]) => ({ date, total }));
}

/**
 * Total Sales and Gross Profit here are net of returns (see fetchReturns) —
 * this is the "profitability" summary, so it should stay accurate.
 * Transaction count/average sale, and the by-branch/trend charts elsewhere
 * in this file, deliberately stay gross (a return isn't a new transaction,
 * and "activity" views like a daily trend are a normal thing to report
 * gross in most small-business tooling).
 */
export async function getSalesSummary(window: DateWindow = {}): Promise<SalesSummary | null> {
  const [rows, totalCogsGross, returns] = await Promise.all([
    fetchSales(window),
    fetchCogs(window),
    fetchReturns(window),
  ]);
  if (!rows || totalCogsGross === null || returns === null) return null;

  const grossSales = rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const totalSales = grossSales - returns.value;
  const totalCogs = totalCogsGross - returns.cogs;
  const transactionCount = rows.length;

  return {
    totalSales,
    transactionCount,
    averageSale: transactionCount > 0 ? totalSales / transactionCount : 0,
    totalCogs,
    grossProfit: totalSales - totalCogs,
  };
}
