import { createClient } from "@/lib/supabase/server";
import { BUSINESS_NAME } from "@/lib/constants";

export interface AppSettings {
  defaultReorderLevel: number;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  logoUrl: string | null;
  quoteTagline: string | null;
  quoteServicesLine: string | null;
  quotePaymentDetails: string | null;
  quoteTermsAndWarranty: string | null;
  quoteFooterDetails: string | null;
}

const FALLBACK_SETTINGS: AppSettings = {
  defaultReorderLevel: 5,
  businessName: BUSINESS_NAME,
  businessAddress: null,
  businessPhone: null,
  businessEmail: null,
  logoUrl: null,
  quoteTagline: null,
  quoteServicesLine: null,
  quotePaymentDetails: null,
  quoteTermsAndWarranty: null,
  quoteFooterDetails: null,
};

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "default_reorder_level, business_name, business_address, business_phone, business_email, logo_path, quote_tagline, quote_services_line, quote_payment_details, quote_terms_and_warranty, quote_footer_details",
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
    quoteTagline: data.quote_tagline,
    quoteServicesLine: data.quote_services_line,
    quotePaymentDetails: data.quote_payment_details,
    quoteTermsAndWarranty: data.quote_terms_and_warranty,
    quoteFooterDetails: data.quote_footer_details,
  };
}
