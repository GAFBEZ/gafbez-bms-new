interface QuoteFooterContactProps {
  footerDetails: string | null;
}

/** The very last thing on a printed quote, after the Load Calculator.
 * Only renders the Footer Details free text from Settings > Quote
 * Builder Details -- phone/email used to also be repeated here from the
 * Business Profile fields, but that duplicated whatever contact info
 * staff had already written into Footer Details themselves. */
export default function QuoteFooterContact({ footerDetails }: QuoteFooterContactProps) {
  if (!footerDetails) return null;

  return (
    <div className="border-t-2 border-brand-gold pt-3 text-center text-xs text-gray-500 break-inside-avoid">
      <p className="whitespace-pre-line">{footerDetails}</p>
    </div>
  );
}
