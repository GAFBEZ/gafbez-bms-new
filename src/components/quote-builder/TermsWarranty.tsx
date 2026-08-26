interface TermsWarrantyProps {
  termsAndWarranty: string | null;
}

const FRAME_CLASSES =
  "rounded-xl border border-gray-200 bg-white p-5 break-inside-avoid text-sm print:rounded-none print:border-2 print:border-brand-green/25 print:p-6";

/** Its own page, separate from the quotation itself -- reference material
 * (warranty coverage, claim process) that a client keeps rather than
 * something they act on immediately, unlike Payment Details. */
export default function TermsWarranty({ termsAndWarranty }: TermsWarrantyProps) {
  return (
    <div className={`${FRAME_CLASSES} print:break-before-page`}>
      <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold">Terms & Warranty</p>
      <p className="whitespace-pre-line leading-relaxed text-gray-700">
        {termsAndWarranty ?? "Terms & warranty not yet set up. Add them in Settings > Quote Builder Details."}
      </p>
    </div>
  );
}
