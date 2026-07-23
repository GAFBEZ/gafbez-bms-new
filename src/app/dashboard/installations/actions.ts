"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface InstallationFormState {
  error: string | null;
}

interface ParsedInstallationForm {
  branchId: string;
  installationDate: string;
  customerName: string | null;
  totalCharged: number;
  inverterProductId: string | null;
  inverterPrice: number;
  inverterQty: number;
  solarPanelProductId: string | null;
  solarPanelPrice: number;
  solarPanelQty: number;
  batteryProductId: string | null;
  batteryPrice: number;
  batteryQty: number;
  cableAmount: number;
  accessoriesAmount: number;
  installationAmount: number;
}

function toAmount(formData: FormData, key: string): number | null {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function toQty(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseInstallationForm(formData: FormData): ParsedInstallationForm | null {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const installationDate = String(formData.get("installationDate") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const totalCharged = toAmount(formData, "totalCharged");
  const inverterPrice = toAmount(formData, "inverterPrice");
  const inverterQty = toQty(formData, "inverterQty");
  const solarPanelPrice = toAmount(formData, "solarPanelPrice");
  const solarPanelQty = toQty(formData, "solarPanelQty");
  const batteryPrice = toAmount(formData, "batteryPrice");
  const batteryQty = toQty(formData, "batteryQty");
  const cableAmount = toAmount(formData, "cableAmount");
  const accessoriesAmount = toAmount(formData, "accessoriesAmount");
  const installationAmount = toAmount(formData, "installationAmount");

  if (!branchId || !installationDate) return null;
  if (
    totalCharged === null ||
    inverterPrice === null ||
    inverterQty === null ||
    solarPanelPrice === null ||
    solarPanelQty === null ||
    batteryPrice === null ||
    batteryQty === null ||
    cableAmount === null ||
    accessoriesAmount === null ||
    installationAmount === null
  ) {
    return null;
  }

  const inverterProductId = String(formData.get("inverterProductId") ?? "").trim() || null;
  const solarPanelProductId = String(formData.get("solarPanelProductId") ?? "").trim() || null;
  const batteryProductId = String(formData.get("batteryProductId") ?? "").trim() || null;

  return {
    branchId,
    installationDate,
    customerName: customerName || null,
    totalCharged,
    inverterProductId,
    inverterPrice,
    inverterQty,
    solarPanelProductId,
    solarPanelPrice,
    solarPanelQty,
    batteryProductId,
    batteryPrice,
    batteryQty,
    cableAmount,
    accessoriesAmount,
    installationAmount,
  };
}

function toRow(parsed: ParsedInstallationForm) {
  return {
    branch_id: parsed.branchId,
    installation_date: parsed.installationDate,
    customer_name: parsed.customerName,
    total_charged: parsed.totalCharged,
    inverter_product_id: parsed.inverterProductId,
    inverter_price: parsed.inverterPrice,
    inverter_qty: parsed.inverterQty,
    solar_panel_product_id: parsed.solarPanelProductId,
    solar_panel_price: parsed.solarPanelPrice,
    solar_panel_qty: parsed.solarPanelQty,
    battery_product_id: parsed.batteryProductId,
    battery_price: parsed.batteryPrice,
    battery_qty: parsed.batteryQty,
    cable_amount: parsed.cableAmount,
    accessories_amount: parsed.accessoriesAmount,
    installation_amount: parsed.installationAmount,
  };
}

const FORM_ERROR =
  "Fill in the branch and date, and make sure every price/amount field is zero or greater.";

export async function createInstallation(
  _prevState: InstallationFormState,
  formData: FormData,
): Promise<InstallationFormState> {
  const parsed = parseInstallationForm(formData);
  if (!parsed) return { error: FORM_ERROR };

  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { error } = await supabase.from("installations").insert({
    ...toRow(parsed),
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/installations");
  revalidatePath("/dashboard");
  redirect("/dashboard/installations");
}

export async function updateInstallation(
  id: string,
  _prevState: InstallationFormState,
  formData: FormData,
): Promise<InstallationFormState> {
  const parsed = parseInstallationForm(formData);
  if (!parsed) return { error: FORM_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.from("installations").update(toRow(parsed)).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/installations");
  revalidatePath("/dashboard");
  redirect("/dashboard/installations");
}

export async function deleteInstallation(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("installations").delete().eq("id", id);
  revalidatePath("/dashboard/installations");
  revalidatePath("/dashboard");
}
