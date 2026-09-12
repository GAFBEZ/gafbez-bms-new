"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";

export interface SettingsFormState {
  error: string | null;
  success?: boolean;
}

export async function setThemePreference(theme: ThemePreference): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function updateAppSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const defaultReorderLevel = Number(formData.get("defaultReorderLevel"));

  if (!Number.isFinite(defaultReorderLevel) || defaultReorderLevel < 0) {
    return { error: "Enter a reorder level of zero or greater." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ default_reorder_level: defaultReorderLevel })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/inventory/new");
  return { error: null, success: true };
}

export async function updateBusinessProfile(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const businessAddress = String(formData.get("businessAddress") ?? "").trim();
  const businessPhone = String(formData.get("businessPhone") ?? "").trim();
  const businessEmail = String(formData.get("businessEmail") ?? "").trim();

  if (!businessName) {
    return { error: "Business name can't be empty." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      business_name: businessName,
      business_address: businessAddress || null,
      business_phone: businessPhone || null,
      business_email: businessEmail || null,
    })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/login");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

function optionalText(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? null : value;
}

export async function updateQuoteBranding(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      quote_tagline: optionalText(formData, "quoteTagline"),
      quote_services_line: optionalText(formData, "quoteServicesLine"),
      quote_payment_details: optionalText(formData, "quotePaymentDetails"),
      quote_terms_and_warranty: optionalText(formData, "quoteTermsAndWarranty"),
      quote_footer_details: optionalText(formData, "quoteFooterDetails"),
      invoice_payment_terms: optionalText(formData, "invoicePaymentTerms"),
    })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/quote-builder");
  revalidatePath("/dashboard/invoice-builder");
  return { error: null, success: true };
}

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function extensionForLogo(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "jpg";
}

export async function updateLogo(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Logo must be a PNG, JPEG, WebP, or SVG image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Logo must be 2MB or smaller." };
  }

  const supabase = await createClient();

  // A unique path per upload, not a fixed name with upsert:true --
  // getPublicUrl() returns the exact same URL for a fixed path every
  // time, and neither the CDN nor the browser varies its cache by
  // anything else, so replacing the logo at a fixed path kept serving
  // the old cached bytes at that URL (same bug fixed the same way for
  // the installer logo, product images, and installation project photos).
  const path = `logo/current-${Date.now()}.${extensionForLogo(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: settingsError } = await supabase
    .from("app_settings")
    .update({ logo_path: path })
    .eq("id", true);

  if (settingsError) {
    return { error: settingsError.message };
  }

  // Best-effort cleanup of the previous logo file(s), now that the path
  // is unique per upload instead of a single overwritten name.
  try {
    const newFileName = path.split("/").pop();
    const { data: existing } = await supabase.storage.from("branding").list("logo");
    const stalePaths = (existing ?? [])
      .filter((entry) => entry.name !== newFileName)
      .map((entry) => `logo/${entry.name}`);
    if (stalePaths.length > 0) {
      await supabase.storage.from("branding").remove(stalePaths);
    }
  } catch {
    // Cleanup is best-effort -- the upload above already succeeded.
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  return { error: null, success: true };
}

export async function removeLogo(): Promise<void> {
  const supabase = await createClient();
  const { data: current } = await supabase.from("app_settings").select("logo_path").eq("id", true).maybeSingle();

  if (current?.logo_path) {
    await supabase.storage.from("branding").remove([current.logo_path]);
  }
  await supabase.from("app_settings").update({ logo_path: null }).eq("id", true);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/login");
}
