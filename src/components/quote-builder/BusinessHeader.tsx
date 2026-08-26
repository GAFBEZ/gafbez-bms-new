import type { QuoteSystemType } from "@/types";
import CompanyIdentity from "./CompanyIdentity";

export interface QuoteBranding {
  logoUrl: string | null;
  businessName: string;
  tagline: string | null;
  servicesLine: string | null;
  phone: string | null;
  email: string | null;
}

interface BusinessHeaderProps {
  branding: QuoteBranding;
  systemType: QuoteSystemType;
}

const HEADING_BY_SYSTEM_TYPE: Record<QuoteSystemType, string> = {
  full_system: "Quotation for Solar/Inverter System",
  inverter_only: "Quotation for Inverter & Battery System",
};

/** Read-only: GAFBEZ's own identity, sourced from Settings > Quote
 * Builder Details / Business Profile (app_settings) rather than typed on
 * every quote -- there's only ever one business on this side of the
 * builder, unlike the installer version where every user has their own. */
export default function BusinessHeader({ branding, systemType }: BusinessHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 border-b-4 border-brand-gold pb-2 text-center break-inside-avoid print:gap-1.5 print:pb-1.5">
      <CompanyIdentity branding={branding} />
      <p className="mt-1 text-base font-bold uppercase tracking-wide text-black print:mt-0.5 print:text-sm">
        {HEADING_BY_SYSTEM_TYPE[systemType]}
      </p>
    </div>
  );
}
