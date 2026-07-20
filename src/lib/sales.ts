import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type { Sale, SaleDetail, SaleStatus } from "@/types";

interface SaleRow {
  id: string;
  customer_id: string | null;
  branch_id: string;
  total_amount: number;
  amount_paid: number;
  status: SaleStatus;
  created_at: string;
  created_by: string | null;
  customers: { name: string } | null;
  branches: { name: string } | null;
  sale_items: { count: number }[];
}

function mapRow(row: SaleRow, staffNames: Record<string, string>): Sale {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? null,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? "Unknown branch",
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    status: row.status,
    createdAt: row.created_at,
    itemCount: row.sale_items?.[0]?.count ?? 0,
    recordedBy: row.created_by ? (staffNames[row.created_by] ?? null) : null,
  };
}

const SELECT_WITH_JOINS =
  "id, customer_id, branch_id, total_amount, amount_paid, status, created_at, created_by, customers(name), branches(name), sale_items(count)";

/**
 * Returns null if the query fails (e.g. migration not run yet). Pass
 * branchId ("all" or omitted means unfiltered) to scope to one branch, and/or
 * customerId to scope to one customer's purchase history (Customer Detail).
 */
export async function getSales(
  limit = 100,
  branchId?: string,
  customerId?: string,
): Promise<Sale[] | null> {
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select(SELECT_WITH_JOINS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  const [{ data, error }, staffNames] = await Promise.all([query, getStaffNameMap()]);

  if (error || !data) {
    console.warn("Failed to load sales:", error?.message);
    return null;
  }

  return (data as unknown as SaleRow[]).map((row) => mapRow(row, staffNames));
}

interface SaleDetailRow {
  id: string;
  customer_id: string | null;
  branch_id: string;
  total_amount: number;
  amount_paid: number;
  status: SaleStatus;
  created_at: string;
  customers: { name: string } | null;
  branches: { name: string } | null;
  sale_items: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    products: { name: string; sku: string } | null;
    sale_returns: { quantity: number }[];
  }[];
}

export async function getSale(id: string): Promise<SaleDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, customer_id, branch_id, total_amount, amount_paid, status, created_at,
       customers(name), branches(name),
       sale_items(id, product_id, quantity, unit_price, products(name, sku), sale_returns(quantity))`,
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as SaleDetailRow;

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? null,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? "Unknown branch",
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    status: row.status,
    createdAt: row.created_at,
    items: row.sale_items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.products?.name ?? "Unknown product",
      productSku: item.products?.sku ?? "—",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      quantityReturned: item.sale_returns.reduce((sum, r) => sum + r.quantity, 0),
    })),
  };
}
