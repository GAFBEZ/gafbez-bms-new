import { Mail, Phone } from "lucide-react";

interface QuoteFooterContactProps {
  footerDetails: string | null;
  contact: {
    phone: string | null;
    email: string | null;
  };
}

/** The very last thing on a printed quote, after the Load Calculator --
 * contact details are a closing note, not part of either the quotation
 * or the warranty terms, so it doesn't belong sharing a page with either. */
export default function QuoteFooterContact({ footerDetails, contact }: QuoteFooterContactProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 border-t-2 border-brand-gold pt-3 text-center text-xs text-gray-500 break-inside-avoid">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {contact.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {contact.phone}
          </span>
        )}
        {contact.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {contact.email}
          </span>
        )}
      </div>
      {footerDetails && <p className="whitespace-pre-line">{footerDetails}</p>}
    </div>
  );
}
