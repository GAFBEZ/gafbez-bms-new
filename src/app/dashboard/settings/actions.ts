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

const LOGO_PATH = "logo/current";
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

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

  // Always the same path (upsert), so replacing the logo never leaves an
  // orphaned old file behind under a different name/extension.
  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(LOGO_PATH, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: settingsError } = await supabase
    .from("app_settings")
    .update({ logo_path: LOGO_PATH })
    .eq("id", true);

  if (settingsError) {
    return { error: settingsError.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  return { error: null, success: true };
}

export async function removeLogo(): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from("branding").remove([LOGO_PATH]);
  await supabase.from("app_settings").update({ logo_path: null }).eq("id", true);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/login");
}
