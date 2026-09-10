import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type {
  BranchSalesSummary,
  ReturnDetail,
  ReturnsSummary,
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

interface ReturnRow {
  id: string;
  quantity: number;
  created_at: string;
  sale_items: {
    product_id: string;
    unit_price: number;
    unit_cost: number;
    products: { name: string; sku: string } | null;
    sales: {
      branch_id: string;
      created_by: string | null;
      branches: { name: string } | null;
    } | null;
  } | null;
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

async function fetchSales(window: DateWindow, staffId?: string): Promise<SaleAggregateRow[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("branch_id, total_amount, created_at, created_by, branches(name)");

  if (window.since) query = query.gte("created_at", window.since.toISOString());
  if (window.until) query = query.lt("created_at", window.until.toISOString());
  if (staffId) query = query.eq("created_by", staffId);

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
async function fetchCogs(window: DateWindow, staffId?: string): Promise<number | null> {
  const supabase = await createClient();
  let query = supabase.from("sale_items").select("quantity, unit_cost, sales!inner(created_at, created_by)");

  if (window.since) query = query.gte("sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sales.created_at", window.until.toISOString());
  if (staffId) query = query.eq("sales.created_by", staffId);

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
 * Every return in the window, attributed to the *original sale's* date and
 * branch/staff (not the return's own) -- a return simply nets against the
 * sale/branch/staff/product it belongs to rather than needing its own
 * separate bucket. Shared by every function below that needs to net
 * returns out of a gross figure, plus the Returns section's own detail
 * list and summary.
 */
async function fetchReturnRows(window: DateWindow, staffId?: string): Promise<ReturnRow[] | null> {
  const supabase = await createClient();
  let query = supabase.from("sale_returns").select(
    `id, quantity, created_at,
     sale_items!inner(product_id, unit_price, unit_cost, products(name, sku),
       sales!inner(branch_id, created_at, created_by, branches(name)))`,
  );

  if (window.since) query = query.gte("sale_items.sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sale_items.sales.created_at", window.until.toISOString());
  if (staffId) query = query.eq("sale_items.sales.created_by", staffId);

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load returns:", error?.message);
    return null;
  }

  return data as unknown as ReturnRow[];
}

/** Revenue and cost value of every return in the window -- used to net
 * Total Sales/Gross Profit in getSalesSummary. */
async function fetchReturnTotals(window: DateWindow, staffId?: string): Promise<ReturnTotals | null> {
  const rows = await fetchReturnRows(window, staffId);
  if (!rows) return null;

  return rows.reduce<ReturnTotals>(
    (acc, row) => ({
      value: acc.value + row.quantity * Number(row.sale_items?.unit_price ?? 0),
      cogs: acc.cogs + row.quantity * Number(row.sale_items?.unit_cost ?? 0),
    }),
    { value: 0, cogs: 0 },
  );
}

/**
 * Total value/quantity of returns in the window -- the headline figure for
 * the Returns section (see getReturnDetails for the itemized list it
 * summarizes).
 */
export async function getReturnsSummary(window: DateWindow = {}, staffId?: string): Promise<ReturnsSummary | null> {
  const rows = await fetchReturnRows(window, staffId);
  if (!rows) return null;

  return rows.reduce<ReturnsSummary>(
    (acc, row) => ({
      totalValue: acc.totalValue + row.quantity * Number(row.sale_items?.unit_price ?? 0),
      totalQuantity: acc.totalQuantity + row.quantity,
    }),
    { totalValue: 0, totalQuantity: 0 },
  );
}

/**
 * Every individual return in the window, newest first -- product, quantity,
 * value, and which branch/staff member's sale it came from, so it's
 * possible to see exactly what's being subtracted from the gross-looking
 * figures above without having to dig through Stock Movement.
 */
export async function getReturnDetails(
  window: DateWindow = {},
  staffId?: string,
  limit = 100,
): Promise<ReturnDetail[] | null> {
  const [rows, staffNames] = await Promise.all([fetchReturnRows(window, staffId), getStaffNameMap()]);
  if (!rows) return null;

  return rows
    .map((row) => {
      const createdBy = row.sale_items?.sales?.created_by ?? null;
      return {
        id: row.id,
        productName: row.sale_items?.products?.name ?? "Unknown product",
        sku: row.sale_items?.products?.sku ?? "—",
        quantity: row.quantity,
        value: row.quantity * Number(row.sale_items?.unit_price ?? 0),
        branchName: row.sale_items?.sales?.branches?.name ?? "Unknown branch",
        staffName: createdBy ? (staffNames[createdBy] ?? "Former staff member") : "Unattributed",
        date: row.created_at,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

/**
 * Always aggregates across every branch, regardless of the global branch
 * filter — a branch comparison is the point of this chart, so scoping it
 * to one branch would leave a single trivial bar. Pass a days-based window,
 * a rangeToWindow() for a picked date range, or {} for all-time. An
 * optional staffId narrows this to one salesperson's branch split (the
 * Sales Tracker staff slicer), while still comparing across every branch.
 * Net of returns (see getReturnsSummary/getReturnDetails for the amounts
 * being subtracted), same as the summary cards above.
 */
export async function getSalesByBranch(
  window: DateWindow = {},
  staffId?: string,
): Promise<BranchSalesSummary[] | null> {
  const [rows, returnRows] = await Promise.all([fetchSales(window, staffId), fetchReturnRows(window, staffId)]);
  if (!rows || !returnRows) return null;

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

  for (const returnRow of returnRows) {
    const branchId = returnRow.sale_items?.sales?.branch_id;
    const existing = branchId ? totals.get(branchId) : undefined;
    if (existing) existing.total -= returnRow.quantity * Number(returnRow.sale_items?.unit_price ?? 0);
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

/**
 * Aggregates sales by the staff member who recorded them, across every
 * branch (same "always all-branch" reasoning as getSalesByBranch). A sale
 * with no `created_by` (recorded before Staff Attribution shipped, or by a
 * deleted account) is grouped under "Unattributed" rather than dropped.
 * Net of returns, attributed to the staff member whose sale was returned
 * (not whoever happened to process the return) -- transactionCount stays
 * gross, same reasoning as getSalesSummary.
 */
export async function getSalesByStaff(
  window: DateWindow = {},
): Promise<StaffSalesSummary[] | null> {
  const [rows, returnRows, staffNames] = await Promise.all([
    fetchSales(window),
    fetchReturnRows(window),
    getStaffNameMap(),
  ]);
  if (!rows || !returnRows) return null;

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

  for (const returnRow of returnRows) {
    const key = returnRow.sale_items?.sales?.created_by ?? "unattributed";
    const existing = totals.get(key);
    if (existing) existing.total -= returnRow.quantity * Number(returnRow.sale_items?.unit_price ?? 0);
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
 * Top products by revenue in the window, net of returns -- a fully
 * returned product drops out of the ranking entirely (filtered once
 * quantitySold <= 0) rather than still showing up as if it were kept, and
 * a partially-returned one shows only what's actually still sold.
 * Company-wide unless staffId narrows it to one salesperson's top products
 * (the Sales Tracker staff slicer). Joined via `sales!inner(created_at)` so
 * the date filter applies to the sale's date, same technique as fetchCogs.
 */
export async function getTopProducts(
  window: DateWindow = {},
  limit = 8,
  staffId?: string,
): Promise<TopProductSummary[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sale_items")
    .select("product_id, quantity, unit_price, products(name, sku), sales!inner(created_at, created_by)");

  if (window.since) query = query.gte("sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sales.created_at", window.until.toISOString());
  if (staffId) query = query.eq("sales.created_by", staffId);

  const [{ data, error }, returnRows] = await Promise.all([query, fetchReturnRows(window, staffId)]);

  if (error || !data || !returnRows) {
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

  for (const returnRow of returnRows) {
    const productId = returnRow.sale_items?.product_id;
    const existing = productId ? totals.get(productId) : undefined;
    if (existing) {
      existing.quantitySold -= returnRow.quantity;
      existing.revenue -= returnRow.quantity * Number(returnRow.sale_items?.unit_price ?? 0);
    }
  }

  return Array.from(totals.values())
    .filter((row) => row.quantitySold > 0)
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
export async function getSalesTrend(window: DateWindow, staffId?: string): Promise<SalesTrendPoint[] | null> {
  if (!window.since || !window.until) return null;

  const rows = await fetchSales(window, staffId);
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
 * Total Sales and Gross Profit here are net of returns (see
 * fetchReturnTotals), same as Sales by Branch/Staff/Top Products below --
 * every money figure on this dashboard reflects what was actually kept,
 * not what was originally rung up before a return reversed some of it.
 * Transaction count/average sale, and the daily trend chart, deliberately
 * stay gross: a return isn't a new transaction, and an "activity" view
 * like a daily trend is a normal thing to report gross in most
 * small-business tooling. See getReturnsSummary/getReturnDetails for the
 * Returns section, which shows exactly what's been netted out.
 */
export async function getSalesSummary(window: DateWindow = {}, staffId?: string): Promise<SalesSummary | null> {
  const [rows, totalCogsGross, returns] = await Promise.all([
    fetchSales(window, staffId),
    fetchCogs(window, staffId),
    fetchReturnTotals(window, staffId),
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
