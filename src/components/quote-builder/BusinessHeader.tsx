import Image from "next/image";

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
}

/** Read-only: GAFBEZ's own identity, sourced from Settings > Quote
 * Builder Details / Business Profile (app_settings) rather than typed on
 * every quote -- there's only ever one business on this side of the
 * builder, unlike the installer version where every user has their own. */
export default function BusinessHeader({ branding }: BusinessHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 border-b-4 border-brand-gold pb-2 text-center break-inside-avoid">
      {branding.logoUrl && (
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-brand-gold/50 bg-white">
          <Image src={branding.logoUrl} alt={`${branding.businessName} logo`} fill className="object-contain" sizes="96px" />
        </div>
      )}
      <p className="text-2xl font-extrabold uppercase tracking-wide text-brand-green">{branding.businessName}</p>
      {branding.tagline && <p className="text-base italic text-gray-500">{branding.tagline}</p>}
      {branding.servicesLine && <p className="max-w-md text-sm font-medium text-gray-500">{branding.servicesLine}</p>}
      <p className="mt-1 text-2xl font-extrabold uppercase tracking-[0.15em] text-brand-green">Quotation</p>
    </div>
  );
}
