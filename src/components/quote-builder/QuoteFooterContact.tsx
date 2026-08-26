interface QuoteFooterContactProps {
  footerDetails: string | null;
}

const LABEL_PATTERN = /^(Tel|Phone|Email|Address)\s*:/i;

/** Splits a line like "Tel: 08012345678" into a red label ("Tel:") and a
 * solid-black remainder, matching how staff already write these lines in
 * Settings > Quote Builder Details. A line with no recognized label
 * (e.g. a plain street address with no "Address:" prefix) just renders
 * as plain black text. */
function FooterLine({ line }: { line: string }) {
  const match = line.match(LABEL_PATTERN);
  if (!match) return <>{line}</>;

  const label = match[0];
  const rest = line.slice(label.length);
  return (
    <>
      <span className="font-bold text-red-600">{label}</span>
      {rest}
    </>
  );
}

/** The very last thing on a printed quote, after the Load Calculator.
 * Only renders the Footer Details free text from Settings > Quote
 * Builder Details -- phone/email used to also be repeated here from the
 * Business Profile fields, but that duplicated whatever contact info
 * staff had already written into Footer Details themselves. */
export default function QuoteFooterContact({ footerDetails }: QuoteFooterContactProps) {
  if (!footerDetails) return null;

  return (
    <div className="border-t-2 border-brand-gold pt-3 text-center text-xs text-black break-inside-avoid">
      {footerDetails.split("\n").map((line, index) => (
        <p key={index}>
          <FooterLine line={line} />
        </p>
      ))}
    </div>
  );
}
