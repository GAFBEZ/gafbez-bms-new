"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/dashboard/whatsapp-orders");
}

/** Locks in stock for every line item (same reservation mechanism as an
 * online-payment checkout) and moves the order to whatsapp_confirmed --
 * see confirm_whatsapp_order in 0030_orders_and_payments.sql. Call this
 * once staff and the customer have agreed availability/payment over
 * WhatsApp. */
export async function confirmWhatsAppOrder(orderId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_whatsapp_order", { p_order_id: orderId });
  revalidate();
  return { error: error?.message ?? null };
}

/** Moves the order to cancelled with the given reason -- no separate
 * "rejected" status exists for this order type (see the RPC's own
 * comment). A blank reason is allowed: the RPC falls back to "Unavailable
 * at this branch" on its own. */
export async function rejectWhatsAppOrder(orderId: string, reason: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_whatsapp_order", { p_order_id: orderId, p_reason: reason });
  revalidate();
  return { error: error?.message ?? null };
}

/** Records that the customer actually paid and picked up -- moves a
 * confirmed order to payment_status='successful', status='completed'.
 * See mark_whatsapp_order_paid in 0049_mark_whatsapp_order_paid.sql. */
export async function markWhatsAppOrderPaid(orderId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_whatsapp_order_paid", { p_order_id: orderId });
  revalidate();
  return { error: error?.message ?? null };
}

/** Admin-only, and only for rejected/expired requests -- see
 * delete_whatsapp_order in 0051_admin_delete_whatsapp_order.sql for the
 * exact status gate this enforces server-side regardless of what the UI
 * allows clicking. */
export async function deleteWhatsAppOrder(orderId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_whatsapp_order", { p_order_id: orderId });
  revalidate();
  return { error: error?.message ?? null };
}
