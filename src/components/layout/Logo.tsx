import Image from "next/image";

interface LogoProps {
  variant?: "dark" | "light";
  showWordmark?: boolean;
  size?: "sm" | "lg";
  /** Custom logo from Business Profile (Settings), if one's been uploaded — falls back to the static mark otherwise. */
  logoUrl?: string | null;
}

const markSizeClasses: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-9 w-9 p-1",
  lg: "h-24 w-24 p-2 sm:h-28 sm:w-28 sm:p-2.5 md:h-32 md:w-32",
};

const imageSizes: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 36,
  lg: 128,
};

export function Logo({
  variant = "dark",
  showWordmark = true,
  size = "sm",
  logoUrl,
}: LogoProps) {
  const isLight = variant === "light";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ${markSizeClasses[size]}`}
      >
        <Image
          src={logoUrl || "/logo.jpg"}
          alt="Company logo"
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="h-full w-full object-contain"
          priority={size === "lg"}
        />
      </span>
      {showWordmark && (
        <span
          className={`text-sm font-semibold leading-tight ${
            isLight ? "text-white" : "text-gray-900"
          }`}
        >
          GAFBEZ
          <span className="block text-[11px] font-normal tracking-wide text-brand-gold">
            ENERGIES LTD
          </span>
        </span>
      )}
    </div>
  );
}
