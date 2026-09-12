"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface CustomerFormState {
  error: string | null;
}

interface ParsedCustomerForm {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  branchId: string | null;
  outstandingBalance: number;
  notes: string | null;
}

function parseCustomerForm(formData: FormData): ParsedCustomerForm | null {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const outstandingBalance = Number(formData.get("outstandingBalance") || 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return null;
  if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) return null;

  return {
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    branchId: branchId || null,
    outstandingBalance,
    notes: notes || null,
  };
}

export async function createCustomer(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = parseCustomerForm(formData);
  if (!parsed) {
    return {
      error: "Enter a customer name, and make sure the outstanding balance is zero or greater.",
    };
  }

  // Outstanding balance is admin-only -- it should normally only move
  // via an actual sale/return, not a manually-typed number. A non-admin
  // creating a customer always starts them at 0, regardless of what was
  // submitted. Backed up by a DB trigger (0071) in case this action is
  // ever bypassed.
  const user = await getCurrentUser();
  const outstandingBalance = user?.role === "admin" ? parsed.outstandingBalance : 0;

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email,
    address: parsed.address,
    branch_id: parsed.branchId,
    outstanding_balance: outstandingBalance,
    notes: parsed.notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect("/dashboard/customers");
}

export async function updateCustomer(
  id: string,
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = parseCustomerForm(formData);
  if (!parsed) {
    return {
      error: "Enter a customer name, and make sure the outstanding balance is zero or greater.",
    };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();

  // Outstanding balance is admin-only (see createCustomer) -- a
  // non-admin's edit keeps whatever the balance already was, regardless
  // of what the form submitted, rather than letting them silently change
  // it via an update. Backed up by a DB trigger (0071).
  let outstandingBalance = parsed.outstandingBalance;
  if (user?.role !== "admin") {
    const { data: existing } = await supabase.from("customers").select("outstanding_balance").eq("id", id).maybeSingle();
    outstandingBalance = existing ? Number(existing.outstanding_balance) : parsed.outstandingBalance;
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      address: parsed.address,
      branch_id: parsed.branchId,
      outstanding_balance: outstandingBalance,
      notes: parsed.notes,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect("/dashboard/customers");
}

// Deleting a customer is admin-only in the UI (CustomerTable's canDelete
// prop) -- this backs that up in the action itself in case RLS is ever
// misconfigured, rather than trusting the UI gate alone to keep a
// non-admin from calling this action directly.
export async function deleteCustomer(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    console.warn(`[deleteCustomer] blocked non-admin delete attempt by user ${user?.id ?? "unknown"}`);
    return;
  }

  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}
