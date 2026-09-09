import type { QuoteBranding } from "@/components/quote-builder/BusinessHeader";
import CompanyIdentity from "@/components/quote-builder/CompanyIdentity";

interface InvoiceHeaderProps {
  branding: QuoteBranding;
}

/** Same identity block as the Quote Builder's BusinessHeader, but a
 * fixed "Invoice / Receipt" heading instead of the Quote's per-system-
 * type "Quotation for..." wording -- the one place that wording is
 * explicitly removed, per the request. */
export default function InvoiceHeader({ branding }: InvoiceHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-2 border-b-4 border-brand-gold pb-1.5 text-center avoid-page-break print:gap-0.5 print:pb-0.5">
      <CompanyIdentity branding={branding} />
      <p className="mt-1 text-base font-bold uppercase tracking-wide text-black print:mt-0 print:text-sm">
        Invoice / Receipt
      </p>
    </div>
  );
}
