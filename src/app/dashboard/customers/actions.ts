"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email,
    address: parsed.address,
    branch_id: parsed.branchId,
    outstanding_balance: parsed.outstandingBalance,
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      address: parsed.address,
      branch_id: parsed.branchId,
      outstanding_balance: parsed.outstandingBalance,
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

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}
