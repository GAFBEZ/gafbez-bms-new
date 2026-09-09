"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { InvoiceLineItem, InvoicePayment, QuoteSystemType } from "@/types";

const INVOICE_BUILDER_PATH = "/dashboard/invoice-builder";

export interface SaveInvoiceInput {
  id?: string;
  systemType: QuoteSystemType;
  invoiceNumber: string | null;
  invoiceDate: string;
  clientName: string | null;
  projectLocation: string | null;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatPercent: number;
  total: number;
  depositPercent: number;
  payments: InvoicePayment[];
}

export async function saveInvoice(input: SaveInvoiceInput): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in first." };

  const supabase = await createClient();
  const payload = {
    owner_id: user.id,
    owner_role: "staff" as const,
    system_type: input.systemType,
    invoice_number: input.invoiceNumber,
    invoice_date: input.invoiceDate,
    client_name: input.clientName,
    project_location: input.projectLocation,
    line_items: input.lineItems,
    subtotal: input.subtotal,
    vat_percent: input.vatPercent,
    total: input.total,
    deposit_percent: input.depositPercent,
    payments: input.payments,
  };

  const { data, error } = input.id
    ? await supabase.from("invoices").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("invoices").insert(payload).select("id").single();

  if (error || !data) {
    console.error("[invoices] saveInvoice failed:", error);
    return { error: "We couldn't save this invoice. Please try again." };
  }

  revalidatePath(INVOICE_BUILDER_PATH);
  return { id: data.id as string };
}

export async function deleteInvoice(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) {
    console.error("[invoices] deleteInvoice failed:", error);
    return { error: "We couldn't delete this invoice." };
  }

  revalidatePath(INVOICE_BUILDER_PATH);
  return { ok: true };
}
