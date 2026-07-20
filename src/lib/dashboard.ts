import { createClient } from "@/lib/supabase/server";
import { getSalesSummary } from "@/lib/salesTracker";
import { getTotalExpenses } from "@/lib/expenses";
import type { DashboardMetricKey, LowStockRow } from "@/types";

export interface LiveInventoryDashboardData {
  metrics: Partial<Record<DashboardMetricKey, number>>;
  lowStockProducts: LowStockRow[];
}

/**
 * Computes the dashboard metrics/section that can honestly be derived from
 * the products table alone. Returns null if the query fails (e.g. table
 * missing) so the caller can fall back to demo data instead of breaking.
 */
export async function getLiveInventoryDashboardData(): Promise<LiveInventoryDashboardData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, quantity_in_stock, reorder_level, cost_price, selling_price")
    .eq("is_active", true);

  if (error || !data) {
    console.warn("Falling back to demo dashboard metrics:", error?.message);
    return null;
  }

  const unitsInStock = data.reduce((sum, p) => sum + p.quantity_in_stock, 0);
  const inventoryValue = data.reduce(
    (sum, p) => sum + p.quantity_in_stock * Number(p.cost_price),
    0,
  );
  const expectedRevenue = data.reduce(
    (sum, p) => sum + p.quantity_in_stock * Number(p.selling_price),
    0,
  );

  const lowStockProducts: LowStockRow[] = data
    .filter((p) => p.quantity_in_stock <= p.reorder_level)
    .sort((a, b) => a.quantity_in_stock - b.quantity_in_stock)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      product: p.name,
      remaining: p.quantity_in_stock,
      threshold: p.reorder_level,
    }));

  return {
    metrics: {
      totalProducts: data.length,
      unitsInStock,
      inventoryValue,
      expectedRevenue,
      grossProfit: expectedRevenue - inventoryValue,
    },
    lowStockProducts,
  };
}

/**
 * Sum of customers.outstanding_balance. Returns null if the query fails
 * (e.g. migration not run yet) so the caller can fall back to demo data.
 */
export async function getLiveOutstandingBalance(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").select("outstanding_balance");

  if (error || !data) {
    console.warn("Falling back to demo outstanding balance:", error?.message);
    return null;
  }

  return data.reduce((sum, c) => sum + Number(c.outstanding_balance), 0);
}

/**
 * Sum of sales.total_amount for sales created since local midnight. Returns
 * null if the query fails so the caller can fall back to demo data.
 */
export async function getLiveTodaySales(): Promise<number | null> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", startOfDay.toISOString());

  if (error || !data) {
    console.warn("Falling back to demo today's sales:", error?.message);
    return null;
  }

  return data.reduce((sum, s) => sum + Number(s.total_amount), 0);
}

/**
 * All-time (revenue - cost of goods sold) minus all-time expenses. Sales
 * now capture cost_price per line item at time of sale (see
 * 0014_sale_profit_tracking.sql), so this is true net profit rather than
 * the earlier revenue-minus-expenses proxy -- with one caveat: pre-existing
 * sales recorded before that migration had their cost backfilled using
 * each product's *current* cost_price as an approximation, since the
 * actual historical cost isn't recoverable. Returns null if either
 * underlying query fails, so the caller can fall back to demo data.
 */
export async function getLiveNetProfit(): Promise<number | null> {
  const [salesSummary, totalExpenses] = await Promise.all([
    getSalesSummary(),
    getTotalExpenses(),
  ]);

  if (salesSummary === null || totalExpenses === null) return null;

  return salesSummary.grossProfit - totalExpenses;
}
