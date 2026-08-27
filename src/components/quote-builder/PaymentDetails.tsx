interface PaymentDetailsProps {
  paymentDetails: string | null;
}

/** Nigerian NUBAN account numbers are exactly 10 digits, but staff sometimes
 * type slightly different lengths (old-format numbers, IBAN-ish variants),
 * so this stays a little permissive rather than hardcoding "10". A line
 * that's just a bare run of digits and nothing else is almost certainly
 * the account number, not a phone number or reference code, which always
 * come with surrounding text. */
const ACCOUNT_NUMBER_PATTERN = /^\d{9,11}$/;

function PaymentDetailsLine({ line }: { line: string }) {
  if (ACCOUNT_NUMBER_PATTERN.test(line.trim())) {
    return <span className="font-bold text-blue-700">{line}</span>;
  }
  return <>{line}</>;
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
  const lines = (paymentDetails ?? "Payment details not yet set up. Add them in Settings > Quote Builder Details.").split(
    "\n",
  );

  return (
    <div className="mt-5 border-t border-gray-200 pt-4 text-sm print:mt-1 print:pt-1 print:text-xs">
      <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold print:mb-0.5 print:text-xs">
        Payment Details
      </p>
      <div className="leading-relaxed text-black print:leading-tight">
        {lines.map((line, index) => (
          <p key={index}>
            <PaymentDetailsLine line={line} />
          </p>
        ))}
      </div>
    </div>
  );
}
