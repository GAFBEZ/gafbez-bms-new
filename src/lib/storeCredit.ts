import { createClient } from "@/lib/supabase/server";
import type { StoreCreditAccountSummary, StoreCreditLedgerEntry, StoreCreditTransactionType } from "@/types";

interface StoreCreditAccountRow {
  customer_id: string;
  balance: number | string;
  customer_profiles: { full_name: string } | null;
}

interface StoreCreditLedgerRow {
  id: string;
  customer_id: string;
  transaction_type: StoreCreditTransactionType;
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  description: string;
  created_at: string;
  customer_profiles: { full_name: string } | null;
}

/** Owner/Admin only -- RLS on store_credit_accounts/store_credit_ledger
 * only lets admins read every customer's row (a customer only ever reads
 * their own, via the website, never through this BMS). Section 31:
 * "Owner should see... store credit liabilities" -- Managers do not get
 * this screen. */
export async function getStoreCreditAccounts(): Promise<StoreCreditAccountSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_credit_accounts")
    .select("customer_id, balance, customer_profiles(full_name)")
    .order("balance", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load store credit accounts:", error?.message);
    return [];
  }

  return (data as unknown as StoreCreditAccountRow[]).map((row) => ({
    customerId: row.customer_id,
    customerName: row.customer_profiles?.full_name ?? null,
    balance: Number(row.balance),
  }));
}

export async function getStoreCreditLedger(limit = 50): Promise<StoreCreditLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_credit_ledger")
    .select("id, customer_id, transaction_type, amount, balance_before, balance_after, description, created_at, customer_profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("Failed to load store credit ledger:", error?.message);
    return [];
  }

  return (data as unknown as StoreCreditLedgerRow[]).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_profiles?.full_name ?? null,
    transactionType: row.transaction_type,
    amount: Number(row.amount),
    balanceBefore: Number(row.balance_before),
    balanceAfter: Number(row.balance_after),
    description: row.description,
    createdAt: row.created_at,
  }));
}
