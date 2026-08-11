"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AdjustCreditFormState {
  error: string | null;
}

const initial: AdjustCreditFormState = { error: null };

export async function adjustStoreCredit(_prevState: AdjustCreditFormState, formData: FormData): Promise<AdjustCreditFormState> {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();

  if (!customerId || !Number.isFinite(amount) || amount === 0 || !description) {
    return { error: "Enter a customer id, a non-zero amount, and a description." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_store_credit", {
    p_customer_id: customerId,
    p_amount: amount,
    p_description: description,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/refunds");
  return initial;
}
