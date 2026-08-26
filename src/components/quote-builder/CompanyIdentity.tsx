import Image from "next/image";
import type { QuoteBranding } from "./BusinessHeader";

interface CompanyIdentityProps {
  branding: QuoteBranding;
}

/** Logo + name + tagline + services line, shared between BusinessHeader
 * (page one) and the top of the Load Calculator's own printed page --
 * repeated there so that page doesn't read as a headless orphan when it
 * lands on its own sheet of paper. */
export default function CompanyIdentity({ branding }: CompanyIdentityProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      {branding.logoUrl && (
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-brand-gold/50 bg-white">
          <Image src={branding.logoUrl} alt={`${branding.businessName} logo`} fill className="object-contain" sizes="96px" />
        </div>
      )}
      <p className="text-2xl font-extrabold uppercase tracking-wide text-brand-gold">{branding.businessName}</p>
      {branding.tagline && <p className="text-base italic text-orange-800">{branding.tagline}</p>}
      {branding.servicesLine && <p className="max-w-md text-sm font-semibold text-gray-800">{branding.servicesLine}</p>}
    </div>
  );
}
