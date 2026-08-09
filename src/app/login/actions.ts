"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWebsiteUrl } from "@/lib/site";
import { checkLoginRateLimit, checkPasswordResetRateLimit } from "@/lib/rateLimit";

export interface LoginState {
  error: string | null;
}

export interface ForgotPasswordState {
  status: "idle" | "success" | "error";
  message?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the same Supabase reset email the website's own forgot-password
 * flow does, so staff using this app's direct /login (rather than the
 * unified website login) aren't stuck with no self-serve recovery path.
 * The link lands on the website's /auth/confirm -> /reset-password, since
 * the "choose a new password" page only exists there, not duplicated
 * here.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  if (!(await checkPasswordResetRateLimit(email))) {
    return { status: "error", message: "Too many requests. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getWebsiteUrl()}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    // Logged, never surfaced -- otherwise this endpoint could be used to
    // test which emails have an account (enumeration), same reasoning as
    // the website's own requestPasswordReset().
    console.error("[bms login] resetPasswordForEmail failed:", error);
  }

  return {
    status: "success",
    message: "If an account exists for that email, we've sent a password reset link.",
  };
}

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both your email address and password." };
  }

  if (!(await checkLoginRateLimit(email))) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  // auth.users is shared with the public website's customer accounts (see
  // 0029_customer_accounts_and_cart.sql) -- a customer has no row here at
  // all. Reject explicitly rather than silently falling through to
  // /dashboard, where getCurrentUser() would bounce them straight back
  // anyway with no explanation.
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account does not have access to the BMS." };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact an administrator." };
  }

  redirect("/dashboard");
}
