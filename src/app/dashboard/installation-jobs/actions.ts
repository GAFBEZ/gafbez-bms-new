"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface InstallationJobActionState {
  error: string | null;
}

const initial: InstallationJobActionState = { error: null };

function revalidate(id: string) {
  revalidatePath("/dashboard/installation-jobs");
  revalidatePath(`/dashboard/installation-jobs/${id}`);
}

export async function scheduleInspection(
  id: string,
  _prevState: InstallationJobActionState,
  formData: FormData,
): Promise<InstallationJobActionState> {
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const address = String(formData.get("customerAddress") ?? "");
  if (!scheduledAt) return { error: "Pick a date and time." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_inspection", {
    p_installation_job_id: id,
    p_scheduled_at: new Date(scheduledAt).toISOString(),
    p_customer_address: address,
  });

  if (error) return { error: error.message };
  revalidate(id);
  return initial;
}

export async function recordInspectionResult(
  id: string,
  _prevState: InstallationJobActionState,
  formData: FormData,
): Promise<InstallationJobActionState> {
  const result = String(formData.get("result") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const recommendedPackageId = String(formData.get("recommendedPackageId") ?? "") || null;

  if (result !== "suitable" && result !== "unsuitable") return { error: "Choose a result." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_inspection_result", {
    p_installation_job_id: id,
    p_result: result,
    p_notes: notes,
    p_recommended_package_id: recommendedPackageId,
  });

  if (error) return { error: error.message };
  revalidate(id);
  return initial;
}

export async function scheduleInstallation(
  id: string,
  _prevState: InstallationJobActionState,
  formData: FormData,
): Promise<InstallationJobActionState> {
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const assignedStaffId = String(formData.get("assignedStaffId") ?? "") || null;
  if (!scheduledAt) return { error: "Pick a date and time." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_installation", {
    p_installation_job_id: id,
    p_scheduled_at: new Date(scheduledAt).toISOString(),
    p_assigned_staff_id: assignedStaffId,
  });

  if (error) return { error: error.message };
  revalidate(id);
  return initial;
}

export async function startInstallation(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("start_installation", { p_installation_job_id: id });
  revalidate(id);
}

export async function completeInstallation(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("complete_installation", { p_installation_job_id: id });
  revalidate(id);
}
