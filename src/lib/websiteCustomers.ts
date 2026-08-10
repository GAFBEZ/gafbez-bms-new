import { createClient } from "@/lib/supabase/server";
import type { WebsiteCustomer } from "@/types";

interface WebsiteCustomerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  email_verified: boolean;
  is_active: boolean;
  installer_status: WebsiteCustomer["installerStatus"];
  business_name: string | null;
  created_at: string;
}

/** Every website self-registered account -- staff-wide read (see
 * 0043_website_customers_staff_read.sql), matching the existing
 * "Customers" page's access level. Distinct from getCustomers()
 * (src/lib/customers.ts), which reads the unrelated public.customers
 * table (staff-entered wholesale/walk-in contacts, no login). */
export async function getWebsiteCustomers(): Promise<WebsiteCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("id, full_name, email, phone, email_verified, is_active, installer_status, business_name, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load website customers:", error?.message);
    return [];
  }

  return (data as unknown as WebsiteCustomerRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    emailVerified: row.email_verified,
    isActive: row.is_active,
    installerStatus: row.installer_status,
    businessName: row.business_name,
    createdAt: row.created_at,
  }));
}
