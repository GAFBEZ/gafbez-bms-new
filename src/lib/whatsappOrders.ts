import { createClient } from "@/lib/supabase/server";
import type { WhatsAppOrder } from "@/types";

interface WhatsAppOrderRow {
  id: string;
  order_number: string;
  status: WhatsAppOrder["status"];
  payment_status: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string;
  branch_id: string;
  subtotal: number | string;
  created_at: string;
  cancellation_reason: string | null;
  branches: { name: string } | null;
  order_items: { product_name: string; quantity: number; line_total: number | string }[] | null;
}

const SELECT_COLUMNS = `
  id, order_number, status, payment_status, customer_name, customer_phone, customer_email,
  branch_id, subtotal, created_at, cancellation_reason,
  branches (name),
  order_items (product_name, quantity, line_total)
`;

function mapRow(row: WhatsAppOrderRow): WhatsAppOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? row.branch_id,
    subtotal: Number(row.subtotal),
    createdAt: row.created_at,
    cancellationReason: row.cancellation_reason,
    items: (row.order_items ?? []).map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    })),
  };
}

/** RLS already scopes this to admin (all branches) or branch staff (their
 * own branch's orders) -- see public.orders' policies in
 * 0030_orders_and_payments.sql. Every WhatsApp order stays on this list
 * regardless of status (review-required, confirmed, paid/completed,
 * cancelled, expired) -- it's the full log, not just the pending queue,
 * capped at the 200 most recent so this doesn't grow unbounded. */
export async function getWhatsAppOrders(): Promise<WhatsAppOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT_COLUMNS)
    .eq("order_type", "whatsapp_request")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    console.warn("Failed to load WhatsApp orders:", error?.message);
    return [];
  }

  return (data as unknown as WhatsAppOrderRow[]).map(mapRow);
}
