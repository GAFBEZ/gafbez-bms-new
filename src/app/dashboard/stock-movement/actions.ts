"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface StockMovementFormState {
  error: string | null;
}

export async function createStockMovement(
  _prevState: StockMovementFormState,
  formData: FormData,
): Promise<StockMovementFormState> {
  const productId = String(formData.get("productId") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const type = String(formData.get("type") ?? "");
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!productId || !branchId || (type !== "in" && type !== "out")) {
    return { error: "Select a product, branch, and movement type." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_product_id: productId,
    p_branch_id: branchId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/stock-movement");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  redirect("/dashboard/stock-movement");
}

export async function transferStock(
  _prevState: StockMovementFormState,
  formData: FormData,
): Promise<StockMovementFormState> {
  const productId = String(formData.get("productId") ?? "");
  const fromBranchId = String(formData.get("fromBranchId") ?? "");
  const toBranchId = String(formData.get("toBranchId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim();

  if (!productId || !fromBranchId || !toBranchId) {
    return { error: "Select a product, and both a from and to branch." };
  }
  if (fromBranchId === toBranchId) {
    return { error: "Choose two different branches to transfer between." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_transfer", {
    p_product_id: productId,
    p_from_branch_id: fromBranchId,
    p_to_branch_id: toBranchId,
    p_quantity: quantity,
    p_note: note || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/stock-movement");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  redirect("/dashboard/stock-movement");
}
