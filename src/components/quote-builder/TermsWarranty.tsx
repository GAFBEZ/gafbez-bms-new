interface TermsWarrantyProps {
  termsAndWarranty: string | null;
}

const FRAME_CLASSES =
  "rounded-xl border border-gray-200 bg-white p-5 break-inside-avoid text-sm print:rounded-none print:border-2 print:border-brand-green/25 print:p-6";

/** Its own page, separate from the quotation itself -- reference material
 * (warranty coverage, claim process) that a client keeps rather than
 * something they act on immediately, unlike Payment Details. A prior,
 * more compressed size (11px/leading-snug) was sized to guarantee it fit
 * one page, but it left most of the page blank for a typical terms block
 * -- this reads at close to normal size instead, still comfortably inside
 * one page for realistic terms lengths. */
export default function TermsWarranty({ termsAndWarranty }: TermsWarrantyProps) {
  return (
    <div className={`${FRAME_CLASSES} print:break-before-page`}>
      <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-brand-gold print:text-base">Terms & Warranty</p>
      <p className="whitespace-pre-line leading-relaxed text-black print:text-sm print:leading-relaxed">
        {termsAndWarranty ?? "Terms & warranty not yet set up. Add them in Settings > Quote Builder Details."}
      </p>
    </div>
  );
}
