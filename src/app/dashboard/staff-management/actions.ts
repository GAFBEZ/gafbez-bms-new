"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service";
import { getCurrentUser } from "@/lib/auth";

export interface StaffFormState {
  error: string | null;
}

export interface PasswordResetState {
  error: string | null;
  success: boolean;
}

interface ParsedStaffForm {
  fullName: string | null;
  role: "admin" | "staff";
  branchId: string | null;
  isActive: boolean;
}

function parseStaffForm(formData: FormData): ParsedStaffForm | null {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const branchId = String(formData.get("branchId") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (role !== "admin" && role !== "staff") return null;

  return {
    fullName: fullName || null,
    role,
    branchId: branchId || null,
    isActive,
  };
}

export async function updateStaffMember(
  id: string,
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const parsed = parseStaffForm(formData);
  if (!parsed) {
    return { error: "Choose a valid role." };
  }

  // The whole /dashboard/staff-management page is admin-only (see
  // staff-management/page.tsx) -- this backs that up in the action
  // itself in case RLS is ever misconfigured, rather than trusting the
  // page-level redirect alone to keep a non-admin from calling this
  // action directly to change someone else's role.
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return { error: "Admins only. Contact an administrator if you need this change made." };
  }

  if (currentUser?.id === id && (parsed.role !== "admin" || !parsed.isActive)) {
    return {
      error: "You can't remove your own admin access or deactivate yourself. Have another admin make this change.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.fullName,
      role: parsed.role,
      branch_id: parsed.branchId,
      is_active: parsed.isActive,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/staff-management");
  redirect("/dashboard/staff-management");
}

/**
 * Sets a staff member's password directly via the Auth Admin API, for
 * when they've lost access to their email and the normal
 * resetPasswordForEmail() link (see login/actions.ts) can't reach them.
 * Requires the service-role client -- no regular authenticated client
 * can call auth.admin.updateUserById.
 */
export async function resetStaffPassword(
  id: string,
  _prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return { error: "Admins only. Contact an administrator if you need this change made.", success: false };
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  if (!hasServiceRoleConfig()) {
    return {
      error: "Password reset isn't configured yet -- SUPABASE_SERVICE_ROLE_KEY is missing from this app's environment variables.",
      success: false,
    };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.updateUserById(id, { password: newPassword });
  if (error) {
    return { error: error.message, success: false };
  }

  return { error: null, success: true };
}
