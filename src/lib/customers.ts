import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/types";

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  branch_id: string | null;
  outstanding_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    branchId: row.branch_id,
    outstandingBalance: Number(row.outstanding_balance),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, name, phone, email, address, branch_id, outstanding_balance, notes, created_at, updated_at";

/**
 * Pass a branchId to scope results to that branch. "all" (or omitted)
 * returns every customer regardless of branch.
 */
export async function getCustomers(branchId?: string): Promise<Customer[]> {
  const supabase = await createClient();
  let query = supabase.from("customers").select(SELECT_COLUMNS).order("name");

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load customers:", error?.message);
    return [];
  }

  return (data as CustomerRow[]).map(mapRow);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapRow(data as CustomerRow);
}
