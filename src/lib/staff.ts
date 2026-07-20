import { createClient } from "@/lib/supabase/server";
import type { StaffMember, StaffRole } from "@/types";

interface StaffRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: StaffRole;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  branches: { name: string } | null;
}

function mapRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS =
  "id, email, full_name, role, branch_id, is_active, created_at, branches(name)";

/** Admin-only: RLS only lets admins read other users' profile rows. */
export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.warn("Failed to load staff members:", error?.message);
    return [];
  }

  return (data as unknown as StaffRow[]).map(mapRow);
}

export async function getStaffMember(id: string): Promise<StaffMember | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapRow(data as unknown as StaffRow);
}

/**
 * id -> full name for every staff member, available to any signed-in
 * user (unlike getStaffMembers(), which RLS restricts to admins) — for
 * resolving a record's `created_by` to a display name in Stock Movement,
 * Daily Sales, and Expenses. Only exposes id/full_name via the
 * get_staff_names() RPC (see 0021_staff_attribution.sql), nothing more
 * sensitive than what's already visible team-wide elsewhere.
 */
export async function getStaffNameMap(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_names");

  if (error || !data) {
    console.warn("Failed to load staff names:", error?.message);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data as { id: string; full_name: string | null }[]) {
    if (row.full_name) map[row.id] = row.full_name;
  }
  return map;
}
