import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

export const ACTIVE_BRANCH_COOKIE = "active_branch";

/**
 * The branch currently selected in the header's BranchSelector, persisted
 * as a cookie so it survives navigation across Server Components without
 * needing a query param on every route. Until the user picks one
 * explicitly (setting the cookie), this defaults to their own assigned
 * branch (profiles.branch_id) rather than "all" -- so a staff member's
 * dashboard opens scoped to their own location right after logging in,
 * not the whole company. Falls back to "all" if they have no assigned
 * branch. Explicitly picking a branch (including "All Branches") always
 * wins once set -- this default only applies before that first choice.
 */
export async function getActiveBranchId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
  if (cookieValue) return cookieValue;

  const user = await getCurrentUser();
  return user?.branchId ?? "all";
}
