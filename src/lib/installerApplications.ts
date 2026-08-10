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
  installer_reviewed_at: string | null;
  created_at: string;
  tiktok_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  google_profile_url: string | null;
}

/** Owner/Admin only -- RLS on customer_profiles only lets is_admin() read
 * every row (a customer only ever reads their own, via the website).
 * Excludes installer_status = 'none' (everyone who never checked the
 * box) at the query level so this never has to page through the entire
 * customer base. */
export async function getInstallerApplications(): Promise<InstallerApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select(
      "id, full_name, email, phone, business_name, installer_status, installer_rejection_reason, installer_reviewed_at, created_at, tiktok_url, instagram_url, website_url, google_profile_url",
    )
    .neq("installer_status", "none")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load installer applications:", error?.message);
    return [];
  }

  return (data as unknown as InstallerApplicationRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    businessName: row.business_name,
    installerStatus: row.installer_status,
    installerRejectionReason: row.installer_rejection_reason,
    installerReviewedAt: row.installer_reviewed_at,
    createdAt: row.created_at,
    tiktokUrl: row.tiktok_url,
    instagramUrl: row.instagram_url,
    websiteUrl: row.website_url,
    googleProfileUrl: row.google_profile_url,
  }));
}
