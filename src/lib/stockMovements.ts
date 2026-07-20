import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type { StockMovement, StockMovementType } from "@/types";

interface StockMovementRow {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  created_at: string;
  created_by: string | null;
  products: { name: string; sku: string } | null;
  branches: { name: string } | null;
}

function mapRow(
  row: StockMovementRow,
  productId: string,
  branchId: string,
  staffNames: Record<string, string>,
): StockMovement {
  return {
    id: row.id,
    productId,
    productName: row.products?.name ?? "Unknown product",
    productSku: row.products?.sku ?? "",
    branchId,
    branchName: row.branches?.name ?? "Unknown branch",
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    createdAt: row.created_at,
    recordedBy: row.created_by ? (staffNames[row.created_by] ?? null) : null,
  };
}

const SELECT_WITH_JOINS =
  "id, product_id, branch_id, type, quantity, reason, created_at, created_by, products(name, sku), branches(name)";

/**
 * Returns null if the query fails (e.g. migration not run yet), so callers
 * can distinguish "couldn't load" from "loaded, zero rows" and fall back
 * to demo data only in the former case. Pass branchId ("all" or omitted
 * means unfiltered) to scope results to one branch.
 */
export async function getStockMovements(
  limit = 100,
  branchId?: string,
): Promise<StockMovement[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select(SELECT_WITH_JOINS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const [{ data, error }, staffNames] = await Promise.all([query, getStaffNameMap()]);

  if (error || !data) {
    console.warn("Failed to load stock movements:", error?.message);
    return null;
  }

  return (
    data as unknown as (StockMovementRow & {
      product_id: string;
      branch_id: string;
    })[]
  ).map((row) => mapRow(row, row.product_id, row.branch_id, staffNames));
}
