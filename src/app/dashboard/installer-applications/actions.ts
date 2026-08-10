"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/dashboard/installer-applications");
}

export async function tempApproveInstallerApplication(customerId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("temp_approve_installer_application", { p_customer_id: customerId });
  revalidate();
  return { error: error?.message ?? null };
}

export async function approveInstallerApplication(customerId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_installer_application", { p_customer_id: customerId });
  revalidate();
  return { error: error?.message ?? null };
}

export async function rejectInstallerApplication(customerId: string, reason: string): Promise<{ error: string | null }> {
  if (!reason.trim()) return { error: "A rejection reason is required." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_installer_application", { p_customer_id: customerId, p_reason: reason });
  revalidate();
  return { error: error?.message ?? null };
}
