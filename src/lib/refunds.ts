import { createClient } from "@/lib/supabase/server";
import type { RefundRequest, RefundRequestStatus, RefundRequestType } from "@/types";

interface RefundRequestRow {
  id: string;
  order_id: string;
  customer_id: string;
  request_type: RefundRequestType;
  reason: string | null;
  requested_amount: number | string;
  status: RefundRequestStatus;
  requested_at: string;
  rejection_reason: string | null;
  paystack_refund_reference: string | null;
  completed_at: string | null;
  orders: { order_number: string; customer_name: string; paystack_reference: string | null; branch_id: string } | null;
}

const SELECT_COLUMNS = `
  id, order_id, customer_id, request_type, reason, requested_amount, status, requested_at,
  rejection_reason, paystack_refund_reference, completed_at,
  orders (order_number, customer_name, paystack_reference, branch_id)
`;

function mapRow(row: RefundRequestRow): RefundRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.orders?.order_number ?? "",
    branchId: row.orders?.branch_id ?? "",
    customerId: row.customer_id,
    customerName: row.orders?.customer_name ?? "",
    requestType: row.request_type,
    reason: row.reason,
    requestedAmount: Number(row.requested_amount),
    status: row.status,
    requestedAt: row.requested_at,
    rejectionReason: row.rejection_reason,
    paystackRefundReference: row.paystack_refund_reference,
    completedAt: row.completed_at,
  };
}

/** RLS already scopes this to admin (all) or branch staff (their own
 * branch's orders' refund requests) -- see refund_requests' policies. */
export async function getRefundRequests(): Promise<RefundRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("refund_requests").select(SELECT_COLUMNS).order("requested_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to load refund requests:", error?.message);
    return [];
  }

  return (data as unknown as RefundRequestRow[]).map(mapRow);
}

export async function getPaystackReferenceForOrder(orderId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("paystack_reference").eq("id", orderId).single();
  return data?.paystack_reference ?? null;
}
