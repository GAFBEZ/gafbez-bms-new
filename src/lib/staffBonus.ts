import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type { DateWindow } from "@/lib/salesTracker";
import type { BonusCategory, BonusRates, StaffBonusSummary } from "@/types";

const BONUS_CATEGORIES: BonusCategory[] = ["solar_panel", "inverter", "battery"];

/** "2026-08" -> the calendar month as a [since, until) window, local time. */
export function monthToWindow(month: string): DateWindow {
  const [year, monthIndex] = month.split("-").map(Number);
  const since = new Date(year, monthIndex - 1, 1);
  const until = new Date(year, monthIndex, 1);
  return { since, until };
}

/** The current calendar month as "YYYY-MM", local time. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getBonusRates(): Promise<BonusRates | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bonus_rates").select("category, amount_per_item");

  if (error || !data) {
    console.warn("Failed to load bonus rates:", error?.message);
    return null;
  }

  const rates: BonusRates = { solar_panel: 0, inverter: 0, battery: 0 };
  for (const row of data as { category: BonusCategory; amount_per_item: number }[]) {
    rates[row.category] = Number(row.amount_per_item);
  }
  return rates;
}

interface BonusSaleItemRow {
  quantity: number;
  products: { bonus_category: BonusCategory | null } | null;
  sales: { created_by: string | null } | null;
}

/**
 * Units sold per staff member per bonus category, restricted to fully
 * paid sales only (business decision -- stock leaving on credit doesn't
 * earn a bonus until the balance is actually collected). Always
 * aggregates across every branch, same "staff performance, not branch
 * performance" reasoning as getSalesByStaff in salesTracker.ts. Pass
 * staffId to scope to one person (used for the non-admin view, which
 * only ever sees their own row).
 */
export async function getStaffBonusSummary(window: DateWindow, staffId?: string): Promise<StaffBonusSummary[] | null> {
  const supabase = await createClient();
  const [rates, staffNames] = await Promise.all([getBonusRates(), getStaffNameMap()]);
  if (!rates) return null;

  let query = supabase
    .from("sale_items")
    .select("quantity, products(bonus_category), sales!inner(created_at, created_by, status)");

  query = query.eq("sales.status", "paid");
  if (window.since) query = query.gte("sales.created_at", window.since.toISOString());
  if (window.until) query = query.lt("sales.created_at", window.until.toISOString());
  if (staffId) query = query.eq("sales.created_by", staffId);

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load staff bonus summary:", error?.message);
    return null;
  }

  const rows = data as unknown as BonusSaleItemRow[];
  const totals = new Map<string, Map<BonusCategory, number>>();

  for (const row of rows) {
    const category = row.products?.bonus_category;
    if (!category) continue;

    const key = row.sales?.created_by ?? "unattributed";
    const byCategory = totals.get(key) ?? new Map<BonusCategory, number>();
    byCategory.set(category, (byCategory.get(category) ?? 0) + row.quantity);
    totals.set(key, byCategory);
  }

  const summaries: StaffBonusSummary[] = Array.from(totals.entries()).map(([key, byCategory]) => {
    const breakdown = BONUS_CATEGORIES.filter((category) => byCategory.has(category)).map((category) => {
      const quantity = byCategory.get(category) ?? 0;
      const rate = rates[category];
      return { category, quantity, rate, bonus: quantity * rate };
    });

    return {
      staffId: key === "unattributed" ? null : key,
      staffName: key === "unattributed" ? "Unattributed" : (staffNames[key] ?? "Former staff member"),
      breakdown,
      totalItems: breakdown.reduce((sum, b) => sum + b.quantity, 0),
      totalBonus: breakdown.reduce((sum, b) => sum + b.bonus, 0),
    };
  });

  return summaries.sort((a, b) => b.totalBonus - a.totalBonus);
}
