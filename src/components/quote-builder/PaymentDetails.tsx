interface PaymentDetailsProps {
  paymentDetails: string | null;
}

/** Sits right after the totals in the main quote card (not its own page)
 * so the quotation and how to pay for it read together on page one --
 * Terms & Warranty is the section that gets pushed to its own page,
 * since it's reference material rather than the actual transaction. */
export default function PaymentDetails({ paymentDetails }: PaymentDetailsProps) {
  return (
    <div className="mt-5 border-t border-gray-200 pt-4 text-sm break-inside-avoid">
      <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold">Payment Details</p>
      <p className="whitespace-pre-line leading-relaxed text-gray-700">
        {paymentDetails ?? "Payment details not yet set up. Add them in Settings > Quote Builder Details."}
      </p>
    </div>
  );
}
