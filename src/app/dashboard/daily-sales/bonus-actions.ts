"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BonusCategory } from "@/types";

export interface BonusRatesFormState {
  error: string | null;
  success?: boolean;
}

const BONUS_CATEGORIES: BonusCategory[] = ["solar_panel", "inverter", "battery"];

/** Admin-only in practice -- enforced by bonus_rates' own RLS update
 * policy (0056_staff_bonus.sql), so a non-admin submitting this gets a
 * database-level rejection even if the UI's admin gate were bypassed. */
export async function updateBonusRates(_prevState: BonusRatesFormState, formData: FormData): Promise<BonusRatesFormState> {
  const supabase = await createClient();

  for (const category of BONUS_CATEGORIES) {
    const raw = Number(formData.get(category));
    if (!Number.isFinite(raw) || raw < 0) {
      return { error: "Each rate must be zero or greater." };
    }

    const { error } = await supabase
      .from("bonus_rates")
      .update({ amount_per_item: raw, updated_at: new Date().toISOString() })
      .eq("category", category);

    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/daily-sales");
  return { error: null, success: true };
}
