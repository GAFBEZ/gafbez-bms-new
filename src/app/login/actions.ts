"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
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
