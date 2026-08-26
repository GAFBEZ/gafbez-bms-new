import type { QuoteSystemType } from "@/types";

interface SystemTypeToggleProps {
  value: QuoteSystemType;
  onChange: (value: QuoteSystemType) => void;
}

const OPTIONS: { value: QuoteSystemType; label: string; hint: string }[] = [
  { value: "full_system", label: "Complete Solar System", hint: "Panels + inverter + battery" },
  { value: "inverter_only", label: "Inverter & Battery Only", hint: "No solar panels" },
];

export default function SystemTypeToggle({ value, onChange }: SystemTypeToggleProps) {
  return (
    <div role="radiogroup" aria-label="System type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              isActive
                ? "border-brand-green bg-brand-green-soft"
                : "border-gray-200 bg-white hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <p className={`text-sm font-semibold ${isActive ? "text-brand-green dark:text-white" : "text-gray-900 dark:text-gray-100"}`}>
              {option.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{option.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
