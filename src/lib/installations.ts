import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type { Installation, InstallationSummary } from "@/types";

interface InstallationRow {
  id: string;
  branch_id: string;
  installation_date: string;
  total_charged: number;
  inverter_product_id: string | null;
  inverter_price: number;
  inverter_qty: number;
  solar_panel_product_id: string | null;
  solar_panel_price: number;
  solar_panel_qty: number;
  battery_product_id: string | null;
  battery_price: number;
  battery_qty: number;
  cable_amount: number;
  accessories_amount: number;
  installation_amount: number;
  cost_total: number;
  profit: number;
  created_at: string;
  created_by: string | null;
  branches: { name: string } | null;
  inverter: { name: string } | null;
  solar_panel: { name: string } | null;
  battery: { name: string } | null;
}

function mapRow(row: InstallationRow, staffNames: Record<string, string> = {}): Installation {
  return {
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? "Unknown branch",
    installationDate: row.installation_date,
    totalCharged: Number(row.total_charged),
    inverterProductId: row.inverter_product_id,
    inverterProductName: row.inverter?.name ?? null,
    inverterPrice: Number(row.inverter_price),
    inverterQty: row.inverter_qty,
    solarPanelProductId: row.solar_panel_product_id,
    solarPanelProductName: row.solar_panel?.name ?? null,
    solarPanelPrice: Number(row.solar_panel_price),
    solarPanelQty: row.solar_panel_qty,
    batteryProductId: row.battery_product_id,
    batteryProductName: row.battery?.name ?? null,
    batteryPrice: Number(row.battery_price),
    batteryQty: row.battery_qty,
    cableAmount: Number(row.cable_amount),
    accessoriesAmount: Number(row.accessories_amount),
    installationAmount: Number(row.installation_amount),
    costTotal: Number(row.cost_total),
    profit: Number(row.profit),
    createdAt: row.created_at,
    recordedBy: row.created_by ? (staffNames[row.created_by] ?? null) : null,
  };
}

const SELECT_WITH_JOIN = `
  id, branch_id, installation_date, total_charged,
  inverter_product_id, inverter_price, inverter_qty,
  solar_panel_product_id, solar_panel_price, solar_panel_qty,
  battery_product_id, battery_price, battery_qty,
  cable_amount, accessories_amount, installation_amount,
  cost_total, profit, created_at, created_by,
  branches(name),
  inverter:products!installations_inverter_product_id_fkey(name),
  solar_panel:products!installations_solar_panel_product_id_fkey(name),
  battery:products!installations_battery_product_id_fkey(name)
`;

/**
 * Pass a branchId to scope results to that branch. "all" (or omitted)
 * returns every installation regardless of branch.
 */
export async function getInstallations(branchId?: string): Promise<Installation[]> {
  const supabase = await createClient();
  let query = supabase
    .from("installations")
    .select(SELECT_WITH_JOIN)
    .order("installation_date", { ascending: false });

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const [{ data, error }, staffNames] = await Promise.all([query, getStaffNameMap()]);

  if (error || !data) {
    console.warn("Failed to load installations:", error?.message);
    return [];
  }

  return (data as unknown as InstallationRow[]).map((row) => mapRow(row, staffNames));
}

export async function getInstallation(id: string): Promise<Installation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installations")
    .select(SELECT_WITH_JOIN)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapRow(data as unknown as InstallationRow);
}

/**
 * Aggregate totals for the summary cards. Scoped the same way as
 * getInstallations -- "all" (or omitted) covers every branch.
 */
export async function getInstallationSummary(branchId?: string): Promise<InstallationSummary> {
  const supabase = await createClient();
  let query = supabase.from("installations").select("total_charged, cost_total, profit");

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load installation summary:", error?.message);
    return { count: 0, totalCharged: 0, totalCost: 0, totalProfit: 0, profitMarginPct: 0 };
  }

  const totalCharged = data.reduce((sum, row) => sum + Number(row.total_charged), 0);
  const totalCost = data.reduce((sum, row) => sum + Number(row.cost_total), 0);
  const totalProfit = data.reduce((sum, row) => sum + Number(row.profit), 0);

  return {
    count: data.length,
    totalCharged,
    totalCost,
    totalProfit,
    profitMarginPct: totalCharged > 0 ? (totalProfit / totalCharged) * 100 : 0,
  };
}
