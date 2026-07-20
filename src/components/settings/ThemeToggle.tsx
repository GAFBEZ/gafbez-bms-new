"use client";

import { useState, useTransition } from "react";
import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import { setThemePreference } from "@/app/dashboard/settings/actions";
import type { ThemePreference } from "@/lib/theme";

interface ThemeToggleProps {
  initialPreference: ThemePreference;
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: MonitorSmartphone },
];

function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

/**
 * Applies the class to <html> immediately (optimistic, for instant visual
 * feedback) and persists the choice in a cookie via a Server Action so it
 * survives reloads and is read server-side on the next request. Per
 * device/browser, not per account — see README "Theme" section for why.
 */
export function ThemeToggle({ initialPreference }: ThemeToggleProps) {
  const [preference, setPreference] = useState(initialPreference);
  const [isPending, startTransition] = useTransition();

  function handleSelect(value: ThemePreference) {
    setPreference(value);
    applyTheme(value);
    startTransition(async () => {
      await setThemePreference(value);
    });
  }

  return (
    <div className="inline-flex rounded-lg border border-gray-300 p-1 dark:border-gray-600">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            disabled={isPending}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? "bg-brand-green text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
