"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPaystackReferenceForOrder } from "@/lib/refunds";
import { hasPaystackConfig, initiateRefund } from "@/lib/paystack";

function revalidate() {
  revalidatePath("/dashboard/refunds");
}

export async function managerApproveRefund(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("manager_approve_refund_request", { p_refund_request_id: id });
  revalidate();
  return { error: error?.message ?? null };
}

export async function rejectRefund(id: string, reason: string): Promise<{ error: string | null }> {
  if (!reason.trim()) return { error: "A rejection reason is required." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_refund_request", { p_refund_request_id: id, p_reason: reason });
  revalidate();
  return { error: error?.message ?? null };
}

/**
 * Owner-only final approval. For a refund/cancellation request this also
 * attempts the real Paystack refund immediately, right here in this
 * Server Action (which runs with this BMS deployment's own
 * PAYSTACK_SECRET_KEY, under an already-authenticated Owner session) --
 * see src/lib/paystack.ts and the "why the BMS needs its own Paystack key"
 * note in STAGE_6_COMBOS_REFUNDS_CREDIT_NOTES.md. If Paystack isn't
 * configured or the call fails, the request is left in 'processing' for
 * a manual completion instead of silently losing the approval.
 */
export async function ownerApproveRefund(id: string, orderId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_approve_refund_request", { p_refund_request_id: id });
  revalidate();

  if (error) return { error: error.message };

  const approved = Array.isArray(data) ? data[0] : data;
  if (approved?.status !== "processing") {
    // store_credit_conversion resolves fully inside the RPC -- nothing
    // more to do here.
    return { error: null };
  }

  if (!hasPaystackConfig()) {
    return { error: null };
  }

  const reference = await getPaystackReferenceForOrder(orderId);
  if (!reference) {
    return { error: "Approved, but no Paystack reference was found -- complete this refund manually." };
  }

  try {
    const result = await initiateRefund(reference);
    const finalStatus = result.status === "processed" || result.status === "pending" ? "completed" : "failed";
    await supabase.rpc("record_paystack_refund_result", {
      p_refund_request_id: id,
      p_paystack_refund_reference: result.reference,
      p_status: finalStatus,
    });
    revalidate();
    return { error: null };
  } catch (paystackError) {
    const message = paystackError instanceof Error ? paystackError.message : "Unknown error";
    console.error(`[refunds] Paystack refund failed for request ${id}:`, message);
    return { error: `Approved, but the automatic Paystack refund failed (${message}). Complete it manually.` };
  }
}

export async function recordManualRefundCompletion(id: string, reference: string): Promise<{ error: string | null }> {
  if (!reference.trim()) return { error: "Enter the Paystack refund reference." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_paystack_refund_result", {
    p_refund_request_id: id,
    p_paystack_refund_reference: reference,
    p_status: "completed",
  });
  revalidate();
  return { error: error?.message ?? null };
}
