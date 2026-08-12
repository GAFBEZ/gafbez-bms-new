import { createClient } from "@/lib/supabase/server";
import type { WhatsAppOrder } from "@/types";

interface WhatsAppOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string;
  branch_id: string;
  subtotal: number | string;
  created_at: string;
  branches: { name: string } | null;
  order_items: { product_name: string; quantity: number; line_total: number | string }[] | null;
}

const SELECT_COLUMNS = `
  id, order_number, customer_name, customer_phone, customer_email, branch_id, subtotal, created_at,
  branches (name),
  order_items (product_name, quantity, line_total)
`;

function mapRow(row: WhatsAppOrderRow): WhatsAppOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? row.branch_id,
    subtotal: Number(row.subtotal),
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),
  };
}

/** RLS already scopes this to admin (all branches) or branch staff (their
 * own branch's orders) -- see public.orders' policies in
 * 0030_orders_and_payments.sql. Only the "awaiting review" queue --
 * confirm_whatsapp_order()/reject_whatsapp_order() move a row to
 * whatsapp_confirmed/cancelled, at which point it drops off this list. */
export async function getPendingWhatsAppOrders(): Promise<WhatsAppOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT_COLUMNS)
    .eq("status", "whatsapp_review_required")
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.warn("Failed to load pending WhatsApp orders:", error?.message);
    return [];
  }

  return (data as unknown as WhatsAppOrderRow[]).map(mapRow);
}
