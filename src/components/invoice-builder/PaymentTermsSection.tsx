interface PaymentTermsSectionProps {
  paymentTerms: string | null;
}

/** Editable at the branding level (Settings > Invoice Builder Details),
 * not per invoice -- same pattern as the Quote Builder's Terms &
 * Warranty (TermsWarranty.tsx): every invoice just shows whatever the
 * current setting is, not a snapshot frozen at save time. */
export const DEFAULT_PAYMENT_TERMS =
  "70% of the total contract amount is payable before installation. The remaining 30% is payable upon completion, testing, commissioning and handover of the solar system. Equipment remains subject to the applicable manufacturer warranties stated in the project quotation/warranty document.";

export default function PaymentTermsSection({ paymentTerms }: PaymentTermsSectionProps) {
  return (
    <div className="avoid-page-break text-black">
      <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-brand-green print:mb-0.5 print:text-xs">
        Payment Terms
      </p>
      <p className="text-xs leading-snug print:leading-tight">{paymentTerms || DEFAULT_PAYMENT_TERMS}</p>
    </div>
  );
}
