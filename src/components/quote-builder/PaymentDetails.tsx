interface PaymentDetailsProps {
  paymentDetails: string | null;
}

/** Sits right after the totals in the main quote card (not its own page)
 * so the quotation and how to pay for it read together on page one --
 * Terms & Warranty is the section that gets pushed to its own page,
 * since it's reference material rather than the actual transaction.
 * Deliberately no break-inside-avoid: on a long quote there may not be
 * enough room left on page one to fit this whole block, and forcing it
 * to never split just pushed the entire section onto page two instead --
 * letting it split keeps at least the heading and opening lines with the
 * quotation, which is closer to what "same page" actually means here. */
export default function PaymentDetails({ paymentDetails }: PaymentDetailsProps) {
  return (
    <div className="mt-5 border-t border-gray-200 pt-4 text-sm">
      <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold">Payment Details</p>
      <p className="whitespace-pre-line leading-relaxed text-black">
        {paymentDetails ?? "Payment details not yet set up. Add them in Settings > Quote Builder Details."}
      </p>
    </div>
  );
}
