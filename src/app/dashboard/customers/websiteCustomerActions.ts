"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service";
import { getCurrentUser } from "@/lib/auth";

/** Admin-only actions on public.customer_profiles rows (website
 * customers and installer applicants alike -- an installer application
 * is just a customer_profiles row with installer_status !== 'none').
 * Distinct from src/app/dashboard/customers/actions.ts, which manages
 * the unrelated staff-entered public.customers table. */

function revalidate() {
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/installer-applications");
}

export async function deactivateWebsiteCustomer(customerId: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return { error: "Only the Owner/Admin can deactivate a customer account." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_deactivate_customer_account", { p_customer_id: customerId });
  if (error) {
    console.error("[websiteCustomers] admin_deactivate_customer_account failed:", error);
    return { error: error.message };
  }

  revalidate();
  return { error: null };
}

/** Five tables reference customer_profiles without ON DELETE CASCADE --
 * see 0044_admin_customer_delete.sql's header comment. Deleting a
 * customer with any row in these would either fail outright (foreign
 * key violation, the exact "Failed to delete user: {}" the Owner hit
 * trying this straight from the Supabase dashboard) or, worse, silently
 * destroy real financial/business records if it somehow succeeded. */
const BLOCKING_TABLES = ["orders", "store_credit_accounts", "store_credit_ledger", "installation_jobs", "refund_requests"] as const;

export async function deleteWebsiteCustomer(customerId: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return { error: "Only the Owner/Admin can delete a customer account." };
  }

  if (!hasServiceRoleConfig()) {
    return { error: "Delete isn't configured yet -- SUPABASE_SERVICE_ROLE_KEY is missing from this app's environment variables." };
  }

  const supabase = await createClient();
  const counts = await Promise.all(
    BLOCKING_TABLES.map((table) => supabase.from(table).select("id", { count: "exact", head: true }).eq("customer_id", customerId)),
  );
  const hasHistory = counts.some((result) => (result.count ?? 0) > 0);

  if (hasHistory) {
    return {
      error: "This account has order, store-credit, installation, or refund history and can't be deleted. Deactivate it instead to keep those records intact.",
    };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.deleteUser(customerId);
  if (error) {
    console.error("[websiteCustomers] auth.admin.deleteUser failed:", error);
    return { error: error.message };
  }

  revalidate();
  return { error: null };
}
