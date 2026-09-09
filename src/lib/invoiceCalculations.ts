import type { InvoiceLineItem, InvoicePayment } from "@/types";

/** Rounds to the nearest whole Naira -- same convention as
 * quoteCalculations.ts's computeLineAmount, invoices never show kobo. */
function round(amount: number): number {
  return Math.round(amount);
}

export function computeLineAmount(item: Pick<InvoiceLineItem, "quantity" | "unitPrice">): number {
  return round(item.quantity * item.unitPrice);
}

export function computeSubtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + computeLineAmount(item), 0);
}

export function computeTotal(subtotal: number, vatPercent: number): number {
  return round(subtotal * (1 + vatPercent / 100));
}

export function computeDepositAmount(total: number, depositPercent: number): number {
  return round(total * (depositPercent / 100));
}

export function computeBalanceAmount(total: number, depositPercent: number): number {
  return total - computeDepositAmount(total, depositPercent);
}

/** The Receipt Confirmation line is always the sum of actual payment
 * rows, never a separately-typed figure -- so it can never drift out of
 * sync with the payment history itself. */
export function computeAmountReceived(payments: InvoicePayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}
