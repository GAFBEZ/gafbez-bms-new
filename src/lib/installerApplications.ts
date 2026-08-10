import { createClient } from "@/lib/supabase/server";
import type { InstallerApplication, InstallerApplicationStatus } from "@/types";

interface InstallerApplicationRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  installer_status: InstallerApplicationStatus;
  installer_rejection_reason: string | null;
  installer_reviewed_by: string | null;
  installer_reviewed_at: string | null;
  installer_temp_approved_by: string | null;
  installer_temp_approved_at: string | null;
  created_at: string;
  tiktok_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  google_profile_url: string | null;
}

/** Owner/Admin or a trusted staff member (can_temp_approve_installers) --
 * RLS on customer_profiles has a matching policy for the latter (see
 * 0042_installer_temp_approval.sql), scoped to installer_status <>
 * 'none' only. Excludes installer_status = 'none' (everyone who never
 * checked the box) at the query level so this never has to page through
 * the entire customer base. */
export async function getInstallerApplications(): Promise<InstallerApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select(
      "id, full_name, email, phone, business_name, installer_status, installer_rejection_reason, installer_reviewed_by, installer_reviewed_at, installer_temp_approved_by, installer_temp_approved_at, created_at, tiktok_url, instagram_url, website_url, google_profile_url",
    )
    .neq("installer_status", "none")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load installer applications:", error?.message);
    return [];
  }

  const rows = data as unknown as InstallerApplicationRow[];

  // installer_reviewed_by/installer_temp_approved_by reference
  // auth.users, not public.profiles, so PostgREST can't embed a staff
  // name via the foreign key directly -- resolve display names with a
  // second lookup instead.
  const staffIds = Array.from(
    new Set(rows.flatMap((row) => [row.installer_reviewed_by, row.installer_temp_approved_by]).filter((id): id is string => Boolean(id))),
  );

  const staffNames = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase.from("profiles").select("id, full_name, email").in("id", staffIds);
    for (const staff of staffRows ?? []) {
      staffNames.set(staff.id, staff.full_name || staff.email || "Unknown staff");
    }
  }

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    businessName: row.business_name,
    installerStatus: row.installer_status,
    installerRejectionReason: row.installer_rejection_reason,
    installerReviewedAt: row.installer_reviewed_at,
    installerReviewedByName: row.installer_reviewed_by ? (staffNames.get(row.installer_reviewed_by) ?? null) : null,
    installerTempApprovedAt: row.installer_temp_approved_at,
    installerTempApprovedByName: row.installer_temp_approved_by ? (staffNames.get(row.installer_temp_approved_by) ?? null) : null,
    createdAt: row.created_at,
    tiktokUrl: row.tiktok_url,
    instagramUrl: row.instagram_url,
    websiteUrl: row.website_url,
    googleProfileUrl: row.google_profile_url,
  }));
}
