"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BRANCH_COOKIE } from "@/lib/activeBranch";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveBranch(branchId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
