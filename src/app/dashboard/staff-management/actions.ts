"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface StaffFormState {
  error: string | null;
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

  const currentUser = await getCurrentUser();
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
