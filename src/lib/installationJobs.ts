import { createClient } from "@/lib/supabase/server";
import type { InstallationJob, InstallationStatus } from "@/types";

interface InstallationJobRow {
  id: string;
  order_id: string;
  combo_package_id: string;
  customer_id: string;
  branch_id: string;
  status: InstallationStatus;
  inspection_required: boolean;
  inspection_scheduled_at: string | null;
  inspection_completed_at: string | null;
  inspection_result: "suitable" | "unsuitable" | null;
  inspection_notes: string | null;
  recommended_package_id: string | null;
  installation_scheduled_at: string | null;
  installation_started_at: string | null;
  installation_completed_at: string | null;
  assigned_staff_id: string | null;
  customer_address: string | null;
  created_at: string;
  orders: { order_number: string; customer_name: string; customer_phone: string | null } | null;
  combo_packages: { name: string } | null;
  branches: { name: string } | null;
}

const SELECT_COLUMNS = `
  id, order_id, combo_package_id, customer_id, branch_id, status, inspection_required,
  inspection_scheduled_at, inspection_completed_at, inspection_result, inspection_notes,
  recommended_package_id, installation_scheduled_at, installation_started_at,
  installation_completed_at, assigned_staff_id, customer_address, created_at,
  orders (order_number, customer_name, customer_phone),
  combo_packages!installation_jobs_combo_package_id_fkey (name),
  branches (name)
`;

function mapRow(row: InstallationJobRow): InstallationJob {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.orders?.order_number ?? "",
    comboPackageId: row.combo_package_id,
    packageName: row.combo_packages?.name ?? "",
    customerId: row.customer_id,
    customerName: row.orders?.customer_name ?? "",
    customerPhone: row.orders?.customer_phone ?? null,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? null,
    status: row.status,
    inspectionRequired: row.inspection_required,
    inspectionScheduledAt: row.inspection_scheduled_at,
    inspectionCompletedAt: row.inspection_completed_at,
    inspectionResult: row.inspection_result,
    inspectionNotes: row.inspection_notes,
    recommendedPackageId: row.recommended_package_id,
    installationScheduledAt: row.installation_scheduled_at,
    installationStartedAt: row.installation_started_at,
    installationCompletedAt: row.installation_completed_at,
    assignedStaffId: row.assigned_staff_id,
    customerAddress: row.customer_address,
    createdAt: row.created_at,
  };
}

/** RLS already scopes this to admin (all branches) or the caller's own
 * branch (Manager/salesperson) -- see installation_jobs' policies in
 * 0031_combo_packages_installations_refunds_credit.sql. No extra
 * branch filter needed here beyond what RLS already applies. */
export async function getInstallationJobs(): Promise<InstallationJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("installation_jobs").select(SELECT_COLUMNS).order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load installation jobs:", error?.message);
    return [];
  }

  return (data as unknown as InstallationJobRow[]).map(mapRow);
}

export async function getInstallationJob(id: string): Promise<InstallationJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("installation_jobs").select(SELECT_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  return mapRow(data as unknown as InstallationJobRow);
}
