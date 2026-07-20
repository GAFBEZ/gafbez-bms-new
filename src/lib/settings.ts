import { createClient } from "@/lib/supabase/server";
import { BUSINESS_NAME } from "@/lib/constants";

export interface AppSettings {
  defaultReorderLevel: number;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  logoUrl: string | null;
}

const FALLBACK_SETTINGS: AppSettings = {
  defaultReorderLevel: 5,
  businessName: BUSINESS_NAME,
  businessAddress: null,
  businessPhone: null,
  businessEmail: null,
  logoUrl: null,
};

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "default_reorder_level, business_name, business_address, business_phone, business_email, logo_path",
    )
    .eq("id", true)
    .single();

  if (error || !data) {
    if (error) console.warn("Falling back to default app settings:", error.message);
    return FALLBACK_SETTINGS;
  }

  const logoUrl = data.logo_path
    ? supabase.storage.from("branding").getPublicUrl(data.logo_path).data.publicUrl
    : null;

  return {
    defaultReorderLevel: data.default_reorder_level,
    businessName: data.business_name,
    businessAddress: data.business_address,
    businessPhone: data.business_phone,
    businessEmail: data.business_email,
    logoUrl,
  };
}
