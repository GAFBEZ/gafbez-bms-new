import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceLineItem, InvoicePayment, QuoteSystemType } from "@/types";

/** Row shape from `select * from public.invoices` (0066_invoice_builder.sql).
 * `line_items`/`payments` are jsonb -- Postgres returns them already
 * parsed as JS values via supabase-js, not as strings needing JSON.parse. */
interface InvoiceRow {
  id: string;
  owner_id: string;
  owner_role: "staff" | "installer";
  system_type: QuoteSystemType;
  invoice_number: string | null;
  invoice_date: string;
  client_name: string | null;
  project_location: string | null;
  line_items: InvoiceLineItem[] | null;
  subtotal: number;
  vat_percent: number;
  total: number;
  deposit_percent: number;
  payments: InvoicePayment[] | null;
  is_quick_receipt: boolean;
  created_at: string;
  updated_at: string;
}

function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerRole: row.owner_role,
    systemType: row.system_type,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    clientName: row.client_name,
    projectLocation: row.project_location,
    lineItems: row.line_items ?? [],
    subtotal: Number(row.subtotal),
    vatPercent: Number(row.vat_percent),
    total: Number(row.total),
    depositPercent: Number(row.deposit_percent),
    payments: row.payments ?? [],
    isQuickReceipt: row.is_quick_receipt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every invoice this staff member has saved, most recent first -- RLS
 * (`owner_id = auth.uid() or (is_admin() and owner_role = 'staff')`)
 * already scopes this to their own rows, or every staff row if they're
 * an admin. The explicit owner_role filter here is defense-in-depth, not
 * load-bearing: it keeps this query's intent (staff invoices only, never
 * installer invoices from the other app) legible without having to go
 * read the RLS policy to know that. */
export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("owner_role", "staff")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to load invoices:", error.message);
    return [];
  }

  return ((data ?? []) as InvoiceRow[]).map(mapInvoiceRow);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("owner_role", "staff")
    .maybeSingle();

  if (error || !data) return null;

  return mapInvoiceRow(data as InvoiceRow);
}
