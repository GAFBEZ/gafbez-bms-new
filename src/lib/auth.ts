import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  branchId: string | null;
}

/**
 * Reads the current session via getClaims() (verifies the JWT locally,
 * unlike getSession() which trusts the cookie as-is) and joins it with the
 * profiles table. Returns null when signed out.
 *
 * Wrapped in React's cache() so calling it from both the dashboard layout
 * and individual pages in the same request only hits the database once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active, branch_id")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? "staff",
    isActive: profile?.is_active ?? true,
    branchId: profile?.branch_id ?? null,
  };
});
