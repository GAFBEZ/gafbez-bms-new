import "server-only";

/**
 * Server-only Paystack refund client, used exclusively by
 * src/app/dashboard/refunds/actions.ts after an Owner has approved a
 * refund. Mirrors the website project's src/lib/paystack/client.ts
 * (same base URL, same error-shape handling) but only implements the one
 * endpoint the BMS needs.
 */
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function hasPaystackConfig(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

interface RefundResult {
  status: string;
  reference: string;
}

function isValidRefundResponse(body: unknown): body is { status: boolean; data: { status: string; transaction: { reference: string } } } {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.status !== "boolean" || !candidate.data || typeof candidate.data !== "object") return false;
  const data = candidate.data as Record<string, unknown>;
  return typeof data.status === "string" && !!data.transaction && typeof (data.transaction as Record<string, unknown>).reference === "string";
}

/**
 * Paystack's Create Refund endpoint. `amountNaira` is optional -- when
 * omitted, Paystack refunds the full transaction amount, which is what
 * every caller here wants (partial Paystack refunds are out of scope,
 * same "full payment only, no partial anything" rule as checkout).
 */
export async function initiateRefund(paystackReference: string): Promise<RefundResult> {
  if (!hasPaystackConfig()) {
    throw new Error("Paystack is not configured: set PAYSTACK_SECRET_KEY.");
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: paystackReference }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || !isValidRefundResponse(body)) {
    const message =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Paystack refund request failed with status ${response.status}`;
    throw new Error(message);
  }

  return { status: body.data.status, reference: body.data.transaction.reference };
}
