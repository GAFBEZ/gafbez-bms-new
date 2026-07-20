import type { DashboardMetric } from "@/types";

export function DashboardCard({
  label,
  value,
  helperText,
  icon: Icon,
  accent,
}: Omit<DashboardMetric, "key">) {
  return (
    <div
      className="rounded-xl p-3 text-white shadow-sm sm:p-5"
      style={{ backgroundColor: accent }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 sm:h-9 sm:w-9"
        aria-hidden="true"
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
      </span>
      <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-wide text-white sm:mt-3 sm:text-xs">
        {label}
      </p>
      <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-white sm:mt-1 sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-white/90 sm:mt-1 sm:text-xs">
        {helperText}
      </p>
    </div>
  );
}
