import { Mail, Phone } from "lucide-react";

interface TermsPaymentFooterProps {
  paymentDetails: string | null;
  termsAndWarranty: string | null;
  footerDetails: string | null;
  contact: {
    phone: string | null;
    email: string | null;
  };
}

const FRAME_CLASSES =
  "rounded-xl border border-gray-200 bg-white p-5 break-inside-avoid text-sm print:rounded-none print:border-2 print:border-brand-green/25 print:p-6";

/** Read-only, sourced from Settings > Quote Builder Details (app_settings)
 * -- same reasoning as BusinessHeader. Falls back to a short placeholder
 * line rather than rendering nothing, so a printed quote never has an
 * obviously-empty section. Payment Details and Terms & Warranty are each
 * their own bordered frame and Payment Details always starts a fresh
 * printed page, matching the installer builder's layout. */
export default function TermsPaymentFooter({ paymentDetails, termsAndWarranty, footerDetails, contact }: TermsPaymentFooterProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className={`${FRAME_CLASSES} print:break-before-page`}>
        <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold">Payment Details</p>
        <p className="whitespace-pre-line leading-relaxed text-gray-700">
          {paymentDetails ?? "Payment details not yet set up. Add them in Settings > Quote Builder Details."}
        </p>
      </div>

      <div className={FRAME_CLASSES}>
        <p className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-brand-gold">Terms & Warranty</p>
        <p className="whitespace-pre-line leading-relaxed text-gray-700">
          {termsAndWarranty ?? "Terms & warranty not yet set up. Add them in Settings > Quote Builder Details."}
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 border-t-2 border-brand-gold pt-3 text-center text-xs text-gray-500">
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
    </div>
  );
}
