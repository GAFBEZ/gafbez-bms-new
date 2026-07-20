"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AccountFormState {
  error: string | null;
  success?: boolean;
}

export async function updateOwnProfile(
  _prevState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) {
    return { error: "Enter your name." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session has expired. Please sign in again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard", "layout");
  return { error: null, success: true };
}

/**
 * Changes the signed-in user's own password. Re-verifies the current
 * password via signInWithPassword before calling updateUser -- Supabase's
 * API doesn't require this for an already-authenticated session, but
 * skipping it would let anyone who finds a staff member's computer
 * unlocked silently take over the account by "changing" the password
 * without knowing it.
 */
export async function changePassword(
  _prevState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Fill in all three password fields." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation don't match." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (typeof email !== "string") {
    return { error: "Your session has expired. Please sign in again." };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null, success: true };
}
