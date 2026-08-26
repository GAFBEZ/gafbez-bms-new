interface TermsWarrantyProps {
  termsAndWarranty: string | null;
}

const FRAME_CLASSES =
  "rounded-xl border border-gray-200 bg-white p-5 break-inside-avoid text-sm print:rounded-none print:border-2 print:border-brand-green/25 print:p-6";

const FALLBACK_TEXT = "Terms & warranty not yet set up. Add them in Settings > Quote Builder Details.";

/** Staff write Terms & Warranty as one point per paragraph (blank line
 * between each), so a blank-line split turns that straight into a
 * numbered list -- no new UI or migration needed for existing text. */
function splitIntoPoints(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((point) => point.trim())
    .filter(Boolean);
}

/** Its own page, separate from the quotation itself -- reference material
 * (warranty coverage, claim process) that a client keeps rather than
 * something they act on immediately, unlike Payment Details. Rendered as
 * a numbered list rather than paragraphs separated by blank lines: the
 * blank lines between paragraphs were themselves most of what pushed a
 * full terms block past one printed page, more than the font size did. */
export default function TermsWarranty({ termsAndWarranty }: TermsWarrantyProps) {
  const points = splitIntoPoints(termsAndWarranty ?? FALLBACK_TEXT);

  return (
    <div className={`${FRAME_CLASSES} print:break-before-page`}>
      <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-brand-gold print:text-base">Terms & Warranty</p>
      <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed text-black print:space-y-1 print:text-sm print:leading-snug">
        {points.map((point, index) => (
          <li key={index} className="whitespace-pre-line pl-1">
            {point}
          </li>
        ))}
      </ol>
    </div>
  );
}
