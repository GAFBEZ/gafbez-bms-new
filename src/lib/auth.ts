import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  branchId: string | null;
  /** Stage 6: "Manager" of their assigned branch -- see the role-model
   * header comment in 0031_combo_packages_installations_refunds_credit.sql
   * for why this is a flag rather than a third `role` value. */
  isBranchManager: boolean;
  /** Stage 6: Owner-granted permission letting a non-manager branch
   * salesperson act on installation_jobs. */
  canManageInstallations: boolean;
}

/**
 * Reads the current session via getClaims() (verifies the JWT locally,
 * unlike getSession() which trusts the cookie as-is) and joins it with the
 * profiles table. Returns null when signed out, when there is no staff
 * profile row at all, or when the profile is deactivated.
 *
 * auth.users is shared with the public website's self-registered customer
 * accounts (see 0029_customer_accounts_and_cart.sql) -- a customer session
 * has a valid JWT but no row in public.profiles. Returning null in that
 * case (rather than defaulting role/isActive as if they were staff) is
 * what makes "no profile row = not staff" an actual access-control
 * decision instead of just a display default; callers (the dashboard
 * layout, in particular) rely on null here to redirect away.
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
    .select("full_name, role, is_active, branch_id, is_branch_manager, can_manage_installations")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile.full_name,
    role: profile.role,
    isActive: profile.is_active,
    branchId: profile.branch_id,
    isBranchManager: profile.is_branch_manager,
    canManageInstallations: profile.can_manage_installations,
  };
});
