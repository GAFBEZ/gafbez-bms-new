import { createClient } from "@/lib/supabase/server";
import { getStaffNameMap } from "@/lib/staff";
import type { Expense } from "@/types";

interface ExpenseRow {
  id: string;
  branch_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
  created_by: string | null;
  branches: { name: string } | null;
}

function mapRow(row: ExpenseRow, staffNames: Record<string, string> = {}): Expense {
  return {
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? "Unknown branch",
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    createdAt: row.created_at,
    recordedBy: row.created_by ? (staffNames[row.created_by] ?? null) : null,
  };
}

const SELECT_WITH_JOIN =
  "id, branch_id, category, description, amount, expense_date, created_at, created_by, branches(name)";

/**
 * Pass a branchId to scope results to that branch. "all" (or omitted)
 * returns every expense regardless of branch.
 */
export async function getExpenses(branchId?: string): Promise<Expense[]> {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(SELECT_WITH_JOIN)
    .order("expense_date", { ascending: false });

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const [{ data, error }, staffNames] = await Promise.all([query, getStaffNameMap()]);

  if (error || !data) {
    console.warn("Failed to load expenses:", error?.message);
    return [];
  }

  return (data as unknown as ExpenseRow[]).map((row) => mapRow(row, staffNames));
}

export async function getExpense(id: string): Promise<Expense | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(SELECT_WITH_JOIN)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapRow(data as unknown as ExpenseRow);
}

/**
 * Returns null if the query fails (e.g. migration not run yet), so callers
 * can distinguish "couldn't load" from "loaded, zero total."
 */
export async function getTotalExpenses(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").select("amount");

  if (error || !data) {
    console.warn("Failed to load total expenses:", error?.message);
    return null;
  }

  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}
