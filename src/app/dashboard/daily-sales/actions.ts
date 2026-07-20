"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SaleFormState {
  error: string | null;
}

interface RawSaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

function parseItems(raw: string): RawSaleItem[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    for (const item of parsed) {
      if (
        typeof item.productId !== "string" ||
        !item.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        typeof item.unitPrice !== "number" ||
        item.unitPrice < 0
      ) {
        return null;
      }
    }

    return parsed as RawSaleItem[];
  } catch {
    return null;
  }
}

export async function createSale(
  _prevState: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const amountPaid = Number(formData.get("amountPaid") || 0);
  const itemsRaw = String(formData.get("items") ?? "");

  if (!branchId) {
    return { error: "Select a branch." };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { error: "Amount paid must be zero or greater." };
  }

  const items = parseItems(itemsRaw);
  if (!items) {
    return { error: "Add at least one valid line item (product, quantity, price)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sale", {
    p_customer_id: customerId || null,
    p_branch_id: branchId,
    p_items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    p_amount_paid: amountPaid,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/daily-sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movement");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect("/dashboard/daily-sales");
}

export interface ReturnFormState {
  error: string | null;
}

export async function recordReturn(
  saleId: string,
  _prevState: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  const saleItemId = String(formData.get("saleItemId") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!saleItemId) {
    return { error: "Missing sale item." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Enter a return quantity greater than zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_return", {
    p_sale_item_id: saleItemId,
    p_quantity: quantity,
    p_reason: reason || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/daily-sales/${saleId}`);
  revalidatePath("/dashboard/daily-sales");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movement");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales-tracker");
  return { error: null };
}
